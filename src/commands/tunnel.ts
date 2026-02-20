import { spawn } from "child_process";
import { createServer } from "net";
import { logger } from "../utils/logger.ts";
import { select, type SelectChoice } from "../utils/select.ts";
import { input, search } from "@inquirer/prompts";
import {
    loadTunnels,
    addTunnel,
    getTunnel,
    updateTunnelPid,
    deleteTunnel,
    clearDeadPids,
} from "../utils/tunnelStorage.ts";
import type { TunnelConfig, TunnelType } from "../types/tunnelTypes.ts";
import { loadServers } from "../utils/serverStorage.ts";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { existsSync } from "fs";

const SSH_CONFIG_PATH = `${homedir()}/.ssh/config`;

type DiscoveredPort = {
    host: string;
    port: number;
    process?: string;
};

// Parse SSH config to get host aliases
async function getSSHConfigHosts(): Promise<string[]> {
    try {
        if (!existsSync(SSH_CONFIG_PATH)) {
            return [];
        }
        const config = await readFile(SSH_CONFIG_PATH, "utf-8");
        const matches = config.match(/^Host[ \t]+\S+/gm);
        if (!matches) return [];
        return matches.map((match) => match.split(/[ \t]+/)[1]).filter((h): h is string => !!h && h !== "*");
    } catch {
        return [];
    }
}

// Check if a process is running
function isProcessRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function normalizeHost(rawHost: string): string {
    if (rawHost.startsWith("[") && rawHost.endsWith("]")) {
        return rawHost.slice(1, -1);
    }
    const percentIndex = rawHost.indexOf("%");
    if (percentIndex > 0) {
        return rawHost.slice(0, percentIndex);
    }
    if (rawHost === ":::") {
        return "::";
    }
    return rawHost;
}

function extractProcessName(line: string): string | undefined {
    const ssMatch = line.match(/users:\(\("([^"]+)"/);
    if (ssMatch?.[1]) return ssMatch[1];

    const netstatMatch = line.match(/\d+\/([^\s]+)/);
    if (netstatMatch?.[1]) return netstatMatch[1];

    const lsofMatch = line.match(/^(\S+)/);
    if (lsofMatch?.[1]) {
        const token = lsofMatch[1];
        if (!["COMMAND", "LISTEN", "LISTENING", "Proto", "State"].includes(token)) {
            return token;
        }
    }

    return undefined;
}

export function parseListeningPorts(output: string): DiscoveredPort[] {
    const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
    const results: DiscoveredPort[] = [];

    for (const line of lines) {
        if (!/LISTEN|LISTENING|users:\(/i.test(line)) continue;
        const match = [...line.matchAll(/(\S+):(\d+)/g)][0];
        if (!match) continue;

        const rawHost = match[1];
        const rawPort = match[2];
        if (!rawHost || !rawPort) continue;
        const port = Number.parseInt(rawPort, 10);
        if (!Number.isFinite(port)) continue;
        if (rawHost.includes("*")) continue;

        const process = extractProcessName(line);
        results.push({
            host: normalizeHost(rawHost),
            port,
            process: process && ["LISTEN", "LISTENING"].includes(process) ? undefined : process,
        });
    }

    return results;
}

async function runSshCommand(
    server: string,
    remoteCmd: string
): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn("ssh", [server, remoteCmd], { stdio: "pipe" });
        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("close", (code) => {
            resolve({ code, stdout, stderr });
        });
        child.on("error", () => resolve({ code: 1, stdout: "", stderr: "SSH command error" }));

        child.stdin.end();
    });
}

async function getRemoteListeningPorts(server: string): Promise<DiscoveredPort[]> {
    const remoteCmd =
        "ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null || lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null";

    const result = await runSshCommand(server, remoteCmd);
    if (result.code !== 0 && !result.stdout) {
        logger.fail(`Port discovery failed: ${result.stderr.trim() || "SSH command error"}`);
        return [];
    }

    return parseListeningPorts(result.stdout);
}

async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = createServer();
        server.unref();
        server.on("error", () => resolve(false));
        server.listen(port, "127.0.0.1", () => {
            server.close(() => resolve(true));
        });
    });
}

async function getRandomFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (address && typeof address === "object") {
                const port = address.port;
                server.close(() => resolve(port));
            } else {
                server.close(() => reject(new Error("Unable to allocate port")));
            }
        });
    });
}

// Start an SSH tunnel
export async function startTunnel(tunnel: TunnelConfig): Promise<number | null> {
    let sshArgs: string[];

    switch (tunnel.type) {
        case "local":
            // -L localPort:remoteHost:remotePort
            sshArgs = [
                "-L",
                `${tunnel.localPort}:${tunnel.remoteHost}:${tunnel.remotePort}`,
                tunnel.server,
                "-N", // No remote command
                "-o", "ExitOnForwardFailure=yes",
                "-o", "ServerAliveInterval=30",
            ];
            break;
        case "remote":
            // -R remotePort:localhost:localPort
            sshArgs = [
                "-R",
                `${tunnel.remotePort}:localhost:${tunnel.localPort}`,
                tunnel.server,
                "-N",
                "-o", "ExitOnForwardFailure=yes",
                "-o", "ServerAliveInterval=30",
            ];
            break;
        case "dynamic":
            // -D localPort (SOCKS proxy)
            sshArgs = [
                "-D",
                `${tunnel.localPort}`,
                tunnel.server,
                "-N",
                "-o", "ServerAliveInterval=30",
            ];
            break;
    }

    return new Promise((resolve) => {
        const child = spawn("ssh", sshArgs, {
            detached: true,
            stdio: "ignore",
        });

        child.unref();

        // Give it a moment to start or fail
        setTimeout(async () => {
            if (child.pid && isProcessRunning(child.pid)) {
                await updateTunnelPid(tunnel.name, child.pid);
                resolve(child.pid);
            } else {
                resolve(null);
            }
        }, 1000);
    });
}

// Stop a running tunnel
export async function stopTunnel(name: string): Promise<boolean> {
    const tunnel = await getTunnel(name);
    if (!tunnel) {
        logger.fail(`Tunnel "${name}" not found`);
        return false;
    }

    if (!tunnel.pid) {
        logger.warn(`Tunnel "${name}" is not running`);
        return false;
    }

    try {
        process.kill(tunnel.pid, "SIGTERM");
        await updateTunnelPid(name, undefined);
        return true;
    } catch {
        // Process might already be dead
        await updateTunnelPid(name, undefined);
        return true;
    }
}

// List all tunnels with status
export async function listTunnels(): Promise<void> {
    await clearDeadPids();
    const tunnels = await loadTunnels();

    if (tunnels.length === 0) {
        logger.info("No tunnels configured");
        return;
    }

    logger.info("Configured tunnels:\n");
    for (const tunnel of tunnels) {
        const status = tunnel.pid && isProcessRunning(tunnel.pid) ? "running" : "stopped";
        const portInfo = tunnel.type === "dynamic"
            ? `SOCKS :${tunnel.localPort}`
            : tunnel.type === "local"
                ? `localhost:${tunnel.localPort} -> ${tunnel.remoteHost}:${tunnel.remotePort}`
                : `remote:${tunnel.remotePort} -> localhost:${tunnel.localPort}`;

        console.log(`  ${status} ${tunnel.name}`);
        console.log(`     ${tunnel.type.toUpperCase()} | ${tunnel.server} | ${portInfo}`);
        console.log("");
    }
}

// Get available servers (from SSH config + PEM servers)
async function getAvailableServers(): Promise<string[]> {
    const servers: string[] = [];

    // Get SSH config hosts
    const sshHosts = await getSSHConfigHosts();
    servers.push(...sshHosts);

    // Get PEM servers
    try {
        const pemServers = await loadServers();
        servers.push(...pemServers.map((s) => s.name));
    } catch {
        // Ignore errors
    }

    return [...new Set(servers)]; // Deduplicate
}

// Interactive tunnel creation wizard
export async function createTunnelWizard(): Promise<void> {
    // Step 1: Choose tunnel type
    const typeChoices: SelectChoice<TunnelType>[] = [
        { name: "Local Forward (access remote service locally)", value: "local" },
        { name: "Remote Forward (expose local service remotely)", value: "remote" },
        { name: "SOCKS Proxy (dynamic port forwarding)", value: "dynamic" },
    ];

    const tunnelType = await select<TunnelType>("Select tunnel type:", typeChoices);
    if (!tunnelType) return;

    // Step 2: Choose server
    const availableServers = await getAvailableServers();
    let server: string;

    if (availableServers.length > 0) {
        const serverChoices: SelectChoice<string>[] = [
            ...availableServers.map((s) => ({ name: s, value: s })),
            { name: "Enter manually", value: "__manual__" },
        ];

        const selectedServer = await select<string>("Select server:", serverChoices);
        if (!selectedServer) return;

        if (selectedServer === "__manual__") {
            server = await input({ message: "Enter server (user@host or alias):" });
        } else {
            server = selectedServer;
        }
    } else {
        server = await input({ message: "Enter server (user@host or alias):" });
    }

    if (!server) return;

    // Step 3: Configure ports based on type
    let localPort: number;
    let remoteHost = "localhost";
    let remotePort: number = 0;

    if (tunnelType === "local") {
        remoteHost = await input({ message: "Remote host [localhost]:", default: "localhost" });
        const remotePortStr = await input({ message: "Remote port:" });
        remotePort = parseInt(remotePortStr, 10);
        const localPortStr = await input({ message: `Local port [${remotePort}]:`, default: remotePortStr });
        localPort = parseInt(localPortStr, 10);
    } else if (tunnelType === "remote") {
        const localPortStr = await input({ message: "Local port to expose:" });
        localPort = parseInt(localPortStr, 10);
        const remotePortStr = await input({ message: `Remote port [${localPort}]:`, default: localPortStr });
        remotePort = parseInt(remotePortStr, 10);
    } else {
        // SOCKS proxy
        const localPortStr = await input({ message: "Local SOCKS port [1080]:", default: "1080" });
        localPort = parseInt(localPortStr, 10);
    }

    // Step 4: Name the tunnel
    const name = await input({ message: "Name this tunnel:" });
    if (!name) return;

    // Create the tunnel config
    const tunnelConfig: TunnelConfig = {
        name,
        type: tunnelType,
        server,
        localPort,
        remoteHost,
        remotePort,
        createdAt: new Date().toISOString(),
    };

    try {
        await addTunnel(tunnelConfig);
        logger.succeed(`Tunnel "${name}" created!`);

        // Ask if they want to start it now
        const startChoices: SelectChoice<boolean>[] = [
            { name: "Start now", value: true },
            { name: "Start later", value: false },
        ];

        const shouldStart = await select<boolean>("Start the tunnel now?", startChoices);
        if (shouldStart) {
            logger.start(`Starting tunnel "${name}"...`);
            const pid = await startTunnel(tunnelConfig);
            if (pid) {
                logger.succeed(`Tunnel "${name}" started! (PID: ${pid})`);
                if (tunnelType === "local") {
                    logger.info(`Connect to localhost:${localPort} to access ${remoteHost}:${remotePort}`);
                } else if (tunnelType === "dynamic") {
                    logger.info(`SOCKS proxy available at localhost:${localPort}`);
                }
            } else {
                logger.fail(`Failed to start tunnel. Check SSH connection to ${server}`);
            }
        }
    } catch (error) {
        logger.fail(`Failed to create tunnel: ${error}`);
    }
}

async function selectDiscoveredPort(ports: DiscoveredPort[]): Promise<DiscoveredPort | null> {
    const sorted = [...ports].sort((a, b) => {
        if (a.port !== b.port) return a.port - b.port;
        return a.host.localeCompare(b.host);
    });
    const choices = sorted.map((p) => ({
        name: `${p.host}:${p.port}${p.process ? ` (${p.process})` : ""}`,
        value: p,
    }));

    const selected = await search<DiscoveredPort>({
        message: "Select a port (type to filter):",
        pageSize: 5,
        source: async (input) => {
            const term = (input ?? "").trim().toLowerCase();
            if (!term) return choices;
            if (/^\d+$/.test(term)) {
                const port = Number.parseInt(term, 10);
                return choices.filter((c) => c.value.port === port);
            }
            return choices.filter((c) => c.name.toLowerCase().includes(term));
        },
    });

    return selected ?? null;
}

export async function discoverTunnelWizard(): Promise<void> {
    const availableServers = await getAvailableServers();
    let server: string;

    if (availableServers.length > 0) {
        const serverChoices: SelectChoice<string>[] = [
            ...availableServers.map((s) => ({ name: s, value: s })),
            { name: "Enter manually", value: "__manual__" },
        ];

        const selectedServer = await select<string>("Select server:", serverChoices);
        if (!selectedServer) return;

        if (selectedServer === "__manual__") {
            server = await input({ message: "Enter server (user@host or alias):" });
        } else {
            server = selectedServer;
        }
    } else {
        server = await input({ message: "Enter server (user@host or alias):" });
    }

    if (!server) return;

    logger.start(`Discovering listening ports on ${server}...`);
    const ports = await getRemoteListeningPorts(server);
    if (ports.length === 0) {
        logger.fail("No listening ports discovered or discovery failed.");
        return;
    }
    logger.succeed(`Found ${ports.length} listening ports`);

    const selected = await selectDiscoveredPort(ports);
    if (!selected) return;

    const preferredLocalPort = selected.port;
    const localPort = await isPortAvailable(preferredLocalPort)
        ? preferredLocalPort
        : await getRandomFreePort();

    const nameDefault = `${server}-${selected.host}-${selected.port}`;
    const name = await input({ message: "Name this tunnel:", default: nameDefault });
    if (!name) return;

    const tunnelConfig: TunnelConfig = {
        name,
        type: "local",
        server,
        localPort,
        remoteHost: selected.host,
        remotePort: selected.port,
        createdAt: new Date().toISOString(),
    };

    try {
        await addTunnel(tunnelConfig);
        logger.succeed(
            `Tunnel "${name}" created: localhost:${localPort} -> ${selected.host}:${selected.port}`
        );

        logger.start(`Starting tunnel "${name}"...`);
        const pid = await startTunnel(tunnelConfig);
        if (pid) {
            logger.succeed(`Tunnel "${name}" started! (PID: ${pid})`);
            logger.info(`Connect to localhost:${localPort} to access ${selected.host}:${selected.port}`);
        } else {
            logger.fail(`Failed to start tunnel. Check SSH connection to ${server}`);
        }
    } catch (error) {
        logger.fail(`Failed to create tunnel: ${error}`);
    }
}

async function manageTunnels(): Promise<void> {
    await clearDeadPids();
    const tunnels = await loadTunnels();

    if (tunnels.length === 0) {
        logger.info("No tunnels configured");
        return;
    }

    const choices: SelectChoice<string>[] = [
        ...tunnels.map((t) => {
            const running = t.pid && isProcessRunning(t.pid);
            const status = running ? "running" : "stopped";
            const portInfo = t.type === "dynamic"
                ? `SOCKS :${t.localPort}`
                : t.type === "local"
                    ? `localhost:${t.localPort} -> ${t.remoteHost}:${t.remotePort}`
                    : `remote:${t.remotePort} -> localhost:${t.localPort}`;
            return {
                name: `${status} ${t.name} | ${t.server} | ${portInfo}`,
                value: t.name,
            };
        }),
        { name: "Back", value: "__back__" },
    ];

    const selected = await select<string>("Select a tunnel:", choices);
    if (!selected || selected === "__back__") return;

    const tunnel = await getTunnel(selected);
    if (!tunnel) {
        logger.fail(`Tunnel "${selected}" not found`);
        return;
    }

    const running = tunnel.pid && isProcessRunning(tunnel.pid);
    const actionChoices: SelectChoice<string>[] = [
        ...(running ? [{ name: "Stop", value: "stop" }] : [{ name: "Start", value: "start" }]),
        { name: "Delete", value: "delete" },
        { name: "Back", value: "back" },
    ];

    const action = await select<string>(`Action for "${tunnel.name}":`, actionChoices);
    if (!action || action === "back") return;

    if (action === "start") {
        logger.start(`Starting tunnel "${tunnel.name}"...`);
        const pid = await startTunnel(tunnel);
        if (pid) {
            logger.succeed(`Tunnel "${tunnel.name}" started! (PID: ${pid})`);
        } else {
            logger.fail("Failed to start tunnel");
        }
        return;
    }

    if (action === "stop") {
        const stopped = await stopTunnel(tunnel.name);
        if (stopped) {
            logger.succeed(`Tunnel "${tunnel.name}" stopped`);
        }
        return;
    }

    if (action === "delete") {
        if (tunnel.pid && isProcessRunning(tunnel.pid)) {
            await stopTunnel(tunnel.name);
        }
        await deleteTunnel(tunnel.name);
        logger.succeed(`Tunnel "${tunnel.name}" deleted`);
    }
}

// Main tunnel command (interactive menu)
export async function tunnelCommand(): Promise<void> {
    await clearDeadPids();

    const menuChoices: SelectChoice<string>[] = [
        { name: "Discover & Bind Port", value: "discover" },
        { name: "Manage Tunnels", value: "manage" },
        { name: "Back", value: "back" },
    ];

    const action = await select<string>("Tunnel Manager:", menuChoices);
    if (!action || action === "back") return;

    switch (action) {
        case "discover":
            await discoverTunnelWizard();
            break;

        case "manage":
            await manageTunnels();
            break;
    }
}
