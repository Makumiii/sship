import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { mkdir, readdir, stat, readFile } from "fs/promises";
import { join, basename } from "path";
import { spawn } from "child_process";
import { homedir } from "os";
import { EventEmitter } from "events";
import Client from "ssh2-sftp-client";
import { loadServers, getServer } from "../utils/serverStorage.ts";
import type { ServerConfig } from "../types/serverTypes.ts";
import { ensureIdentityInAgent } from "../utils/sshAgent.ts";

const DEFAULT_PORT = 3847;
let activePort = DEFAULT_PORT;
const progressEmitter = new EventEmitter();

interface FileInfo {
    name: string;
    isDir: boolean;
    size: number;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function isEncryptedKeyParseError(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes("cannot parse privatekey") || lower.includes("encrypted private openssh key detected");
}

function buildRemoteSshArgs(server: ServerConfig, command: string): string[] {
    if (server.authMode === "password") {
        throw new Error("Password-auth servers are not supported in Transfer yet. Use identity_file or ssh_agent.");
    }

    const args = [
        "-p",
        String(server.port),
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=10",
    ];

    if (server.authMode === "identity_file") {
        if (!server.identityFile) {
            throw new Error(`Server "${server.name}" is missing identity file`);
        }
        args.push("-i", server.identityFile, "-o", "IdentitiesOnly=yes");
    }

    args.push(`${server.user}@${server.host}`, command);
    return args;
}



async function listLocalFiles(dirPath: string): Promise<FileInfo[]> {
    const dir = dirPath || homedir();
    const files = await readdir(dir, { withFileTypes: true });
    const results: FileInfo[] = [];
    for (const file of files) {
        if (file.name.startsWith(".")) continue;
        try {
            const fullPath = join(dir, file.name);
            const s = await stat(fullPath);
            results.push({ name: file.name, isDir: file.isDirectory(), size: s.size });
        } catch { /* skip inaccessible */ }
    }
    return results.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
}

// Keep using SSH for listing as it is faster/simpler to pipe ls -la than traversing SFTP objects for this specific display format
async function listRemoteFiles(server: ServerConfig, remotePath: string): Promise<{ path: string, files: FileInfo[] }> {
    return new Promise((resolve, reject) => {
        // Use ~ explicitly for home directory if path is empty
        // Note: cd "~" does not expand in bash. cd ~ does.
        // So we strictly handle the default case separately or ensure no quotes for tilde.
        const target = remotePath ? `"${remotePath}"` : "~";
        const cmd = `cd ${target} && pwd && ls -la`;
        let args: string[] = [];
        try {
            args = buildRemoteSshArgs(server, cmd);
        } catch (error) {
            reject(error);
            return;
        }
        const ssh = spawn("ssh", args);
        let out = "";
        let err = "";
        ssh.stdout.on("data", d => out += d);
        ssh.stderr.on("data", d => err += d.toString());
        ssh.on("close", code => {
            if (code !== 0) {
                reject(new Error(err.trim() || `Remote listing failed with exit code ${code}`));
                return;
            }

            const lines = out.split("\n").filter(Boolean);
            const resolvedPath = lines[0]?.trim() || remotePath;
            const fileLines = lines.slice(2);

            const files: FileInfo[] = [];
            for (const l of fileLines) {
                const p = l.trim().split(/\s+/);
                if (p.length < 9 || !p[0]) continue;
                const name = p.slice(8).join(" ");
                if (name === "." || name === ".." || name.startsWith(".")) continue;
                files.push({ name, isDir: p[0].startsWith("d"), size: parseInt(p[4] || "0", 10) });
            }
            resolve({
                path: resolvedPath,
                files: files.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
            });
        });
        ssh.on("error", (error) => reject(error));
    });
}

async function connectSftpWithServerAuth(sftp: Client, server: ServerConfig): Promise<void> {
    if (server.authMode === "password") {
        throw new Error("Password-auth servers are not supported in Transfer yet. Use identity_file or ssh_agent.");
    }

    if (server.authMode === "identity_file") {
        if (!server.identityFile) {
            throw new Error(`Server "${server.name}" is missing identity file`);
        }

        try {
            await sftp.connect({
                host: server.host,
                port: server.port,
                username: server.user,
                privateKey: await readFile(server.identityFile),
                readyTimeout: 20000
            });
            return;
        } catch (error) {
            const message = getErrorMessage(error);
            if (!isEncryptedKeyParseError(message)) {
                throw error;
            }

            const agentStatus = await ensureIdentityInAgent(server.identityFile, { interactive: true });
            const agent = process.env.SSH_AUTH_SOCK;
            if (!agent || (agentStatus !== "added" && agentStatus !== "already_loaded")) {
                throw new Error(
                    `Encrypted key detected at ${server.identityFile}. Could not load it into ssh-agent automatically; run ssh-add ${server.identityFile} and retry.`
                );
            }

            await sftp.connect({
                host: server.host,
                port: server.port,
                username: server.user,
                agent,
                readyTimeout: 20000
            });
            return;
        }
    }

    const agent = process.env.SSH_AUTH_SOCK;
    if (!agent) {
        throw new Error("SSH_AUTH_SOCK is not set. Start an ssh-agent or use identity_file auth mode.");
    }
    await sftp.connect({
        host: server.host,
        port: server.port,
        username: server.user,
        agent,
        readyTimeout: 20000
    });
}

// New SFTP-based transfer with progress streaming
export async function transferFile(req: IncomingMessage, server: ServerConfig, localPath: string, remotePath: string, direction: "upload" | "download"): Promise<void> {
    const sftp = new Client();
    let canceled = false;

    try {
        await connectSftpWithServerAuth(sftp, server);

        // Handle cancellation from HTTP request closing
        const onReqClose = () => {
            canceled = true;
            sftp.end();
        };
        req.on("close", onReqClose);

        const reportProgress = (filePath: string) => (total_transferred: number, chunk: number, total: number) => {
            if (canceled) return;
            // Emit progress event
            const percent = Math.round((total_transferred / total) * 100);
            progressEmitter.emit("progress", { percent, type: direction, file: filePath, bytes: total_transferred, total });
        };

        const ensureRemoteDir = async (path: string) => {
            try {
                await sftp.mkdir(path, true);
            } catch {
                // Ignore if it already exists or cannot be created
            }
        };

        const uploadPath = async (path: string, remoteDir: string) => {
            const stats = await stat(path);
            if (stats.isDirectory()) {
                const dirName = basename(path);
                const nextRemoteDir = remoteDir.endsWith('/')
                    ? `${remoteDir}${dirName}`
                    : `${remoteDir}/${dirName}`;
                await ensureRemoteDir(nextRemoteDir);
                const entries = await readdir(path, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith(".")) continue;
                    const childPath = join(path, entry.name);
                    if (entry.isDirectory()) {
                        await uploadPath(childPath, nextRemoteDir);
                    } else if (entry.isFile()) {
                        await uploadFile(childPath, nextRemoteDir);
                    }
                }
            } else {
                if (!stats.isFile()) {
                    return;
                }
                await uploadFile(path, remoteDir);
            }
        };

        const uploadFile = async (path: string, remoteDir: string) => {
            const fileName = basename(path);
            const finalRemotePath = remoteDir.endsWith('/')
                ? `${remoteDir}${fileName}`
                : `${remoteDir}/${fileName}`;
            await sftp.fastPut(path, finalRemotePath, {
                step: reportProgress(finalRemotePath),
            });
        };

        const downloadPath = async (path: string, localDir: string) => {
            const stats = await sftp.stat(path);
            if (stats.isDirectory) {
                const dirName = basename(path);
                const nextLocalDir = join(localDir, dirName);
                await mkdir(nextLocalDir, { recursive: true });
                const entries = await sftp.list(path);
                for (const entry of entries) {
                    if (!entry.name || entry.name.startsWith(".")) continue;
                    const childPath = `${path.replace(/\/+$/, "")}/${entry.name}`;
                    if (entry.type === "d") {
                        await downloadPath(childPath, nextLocalDir);
                    } else if (entry.type === "-") {
                        await downloadFile(childPath, nextLocalDir);
                    }
                }
            } else {
                await downloadFile(path, localDir);
            }
        };

        const downloadFile = async (path: string, localDir: string) => {
            const fileName = basename(path);
            const finalLocalPath = join(localDir, fileName);
            await sftp.fastGet(path, finalLocalPath, {
                step: reportProgress(path),
            });
        };

        if (direction === "upload") {
            await uploadPath(localPath, remotePath);
        } else {
            await downloadPath(remotePath, localPath);
        }

        req.off("close", onReqClose);
    } catch (err) {
        if (canceled) throw new Error("Transfer canceled by user");
        throw err;
    } finally {
        await sftp.end();
    }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || "/", `http://localhost:${activePort}`);
    const path = url.pathname;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    try {
        // SSE Endpoint
        if (path === "/api/progress") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            });

            const listener = (data: any) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };
            progressEmitter.on("progress", listener);

            // Clean up when client disconnects from SSE
            req.on("close", () => {
                progressEmitter.off("progress", listener);
            });
            return;
        }

        // Serve Static Files
        if (path === "/" || path === "/index.html") {
            const content = await readFile(join(import.meta.dirname, "public", "index.html"), "utf-8");
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(content);
            return;
        }

        if (path === "/style.css") {
            const content = await readFile(join(import.meta.dirname, "public", "style.css"), "utf-8");
            res.writeHead(200, { "Content-Type": "text/css" });
            res.end(content);
            return;
        }

        if (path === "/script.js") {
            const content = await readFile(join(import.meta.dirname, "public", "script.js"), "utf-8");
            res.writeHead(200, { "Content-Type": "application/javascript" });
            res.end(content);
            return;
        }

        if (path === "/api/servers") {
            const s = await loadServers();
            res.end(JSON.stringify({ success: true, data: s }));
            return;
        }

        if (path === "/api/local") {
            const d = url.searchParams.get("path") || homedir();
            const f = await listLocalFiles(d);
            res.end(JSON.stringify({ success: true, data: { path: d, files: f } }));
            return;
        }

        if (path === "/api/remote") {
            const sName = url.searchParams.get("server");
            const rPath = url.searchParams.get("path") || "";
            const s = await getServer(sName || "");
            if (!s) return res.end(JSON.stringify({ success: false, error: "Server not found" }));

            try {
                const result = await listRemoteFiles(s, rPath);
                res.end(JSON.stringify({ success: true, data: result }));
            } catch (error) {
                res.end(JSON.stringify({ success: false, error: getErrorMessage(error) }));
            }
            return;
        }

        if (path === "/api/transfer" && req.method === "POST") {
            let b = ""; req.on("data", c => b += c);
            req.on("end", async () => {
                try {
                    const body = JSON.parse(b);
                    const s = await getServer(body.server);
                    if (s) {
                        await transferFile(req, s, body.localPath, body.remotePath, body.direction);
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.end(JSON.stringify({ success: false, error: "Server not found" }));
                    }
                } catch (e) {
                    res.end(JSON.stringify({ success: false, error: String(e) }));
                }
            });
            return;
        }

        res.writeHead(404); res.end();
    } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ success: false, error: String(e) }));
    }
}

export function startTransferServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        const server = createServer(handleRequest);
        const onError = (error: Error) => reject(error);

        server.once("error", onError);
        server.listen(activePort, () => {
            server.off("error", onError);
            resolve();
        });
    });
}

export function getTransferPort(): number {
    return activePort;
}

export async function startTransferServerWithFallback(startPort = DEFAULT_PORT, maxAttempts = 10): Promise<number> {
    let port = startPort;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        activePort = port;
        try {
            await startTransferServer();
            return activePort;
        } catch (error) {
            lastError = error;
            const code = (error as NodeJS.ErrnoException)?.code;
            if (code !== "EADDRINUSE") {
                throw error;
            }
            port += 1;
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`Unable to bind transfer server after ${maxAttempts} attempts`);
}

export { DEFAULT_PORT as PORT };
