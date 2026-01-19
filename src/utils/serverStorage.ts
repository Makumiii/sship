import { readFile, writeFile, mkdir, copyFile, chmod } from "fs/promises";
import { homedir } from "os";
import { existsSync } from "fs";
import { basename, join } from "path";
import type { ServerConfig, ServersFile } from "../types/serverTypes.ts";

const SSHIP_DIR = join(homedir(), ".sship");
const SERVERS_FILE = join(SSHIP_DIR, "servers.json");
const SSH_DIR = join(homedir(), ".ssh");

async function ensureSshipDir(): Promise<void> {
    if (!existsSync(SSHIP_DIR)) {
        await mkdir(SSHIP_DIR, { recursive: true });
    }
}

export async function loadServers(): Promise<ServerConfig[]> {
    await ensureSshipDir();
    if (!existsSync(SERVERS_FILE)) {
        return [];
    }
    try {
        const content = await readFile(SERVERS_FILE, "utf-8");
        const data: ServersFile = JSON.parse(content);
        return data.servers || [];
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

export async function copyPemToSsh(pemPath: string, serverName: string): Promise<string> {
    if (!existsSync(SSH_DIR)) {
        await mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
    }

    const pemFileName = `${serverName}.pem`;
    const destPath = join(SSH_DIR, pemFileName);

    await copyFile(pemPath, destPath);
    await chmod(destPath, 0o600);

    return destPath;
}
