import { readFile, writeFile, mkdir, copyFile, chmod } from "fs/promises";
import { homedir } from "os";
import { existsSync } from "fs";
import { extname, join } from "path";
import type { ServerConfig, ServersFile } from "../types/serverTypes.ts";

const SSHIP_DIR = join(homedir(), ".sship");
const SERVERS_FILE = join(SSHIP_DIR, "servers.json");
const SSH_DIR = join(homedir(), ".ssh");

async function ensureSshipDir(): Promise<void> {
    if (!existsSync(SSHIP_DIR)) {
        await mkdir(SSHIP_DIR, { recursive: true });
    }
}

function isValidServerConfig(entry: unknown): entry is ServerConfig {
    if (!entry || typeof entry !== "object") return false;
    const server = entry as Partial<ServerConfig>;
    if (typeof server.name !== "string" || server.name.trim() === "") return false;
    if (typeof server.host !== "string" || server.host.trim() === "") return false;
    if (typeof server.port !== "number" || !Number.isFinite(server.port)) return false;
    if (typeof server.user !== "string" || server.user.trim() === "") return false;
    if (server.authMode !== "identity_file" && server.authMode !== "ssh_agent" && server.authMode !== "password") return false;
    if (typeof server.createdAt !== "string" || server.createdAt.trim() === "") return false;
    if (server.authMode === "identity_file" && (!server.identityFile || typeof server.identityFile !== "string")) {
        return false;
    }
    if ((server.authMode === "ssh_agent" || server.authMode === "password") && server.identityFile !== undefined && typeof server.identityFile !== "string") {
        return false;
    }
    return true;
}

export async function loadServers(): Promise<ServerConfig[]> {
    await ensureSshipDir();
    if (!existsSync(SERVERS_FILE)) {
        return [];
    }
    try {
        const content = await readFile(SERVERS_FILE, "utf-8");
        const data: ServersFile = JSON.parse(content);
        if (!Array.isArray(data.servers)) return [];
        return data.servers.filter(isValidServerConfig);
    } catch {
        return [];
    }
}

export async function saveServers(servers: ServerConfig[]): Promise<void> {
    await ensureSshipDir();
    const data: ServersFile = { servers };
    await writeFile(SERVERS_FILE, JSON.stringify(data, null, 2));
}

export async function addServer(server: ServerConfig): Promise<void> {
    const servers = await loadServers();
    const existing = servers.find((s) => s.name === server.name);
    if (existing) {
        throw new Error(`Server with name "${server.name}" already exists`);
    }
    servers.push(server);
    await saveServers(servers);
}

export async function getServer(name: string): Promise<ServerConfig | undefined> {
    const servers = await loadServers();
    return servers.find((s) => s.name === name);
}

export async function updateServer(name: string, updatedServer: ServerConfig): Promise<void> {
    const servers = await loadServers();
    const index = servers.findIndex((s) => s.name === name);
    if (index === -1) {
        throw new Error(`Server "${name}" not found`);
    }
    servers[index] = updatedServer;
    await saveServers(servers);
}

export async function deleteServer(name: string): Promise<void> {
    const servers = await loadServers();
    const filtered = servers.filter((s) => s.name !== name);
    if (filtered.length === servers.length) {
        throw new Error(`Server "${name}" not found`);
    }
    await saveServers(filtered);
}

export async function copyIdentityToSsh(identityPath: string, serverName: string): Promise<string> {
    if (!existsSync(SSH_DIR)) {
        await mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
    }

    const ext = extname(identityPath) || "";
    const identityFileName = `${serverName}${ext}`;
    const destPath = join(SSH_DIR, identityFileName);

    await copyFile(identityPath, destPath);
    await chmod(destPath, 0o600);

    return destPath;
}
