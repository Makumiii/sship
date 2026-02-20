import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { TunnelConfig, TunnelsFile } from "../types/tunnelTypes.ts";

const SSHIP_DIR = join(homedir(), ".sship");
const TUNNELS_FILE = join(SSHIP_DIR, "tunnels.json");

async function ensureSshipDir(): Promise<void> {
    if (!existsSync(SSHIP_DIR)) {
        await mkdir(SSHIP_DIR, { recursive: true });
    }
}

export async function loadTunnels(): Promise<TunnelConfig[]> {
    await ensureSshipDir();
    if (!existsSync(TUNNELS_FILE)) {
        return [];
    }
    try {
        const content = await readFile(TUNNELS_FILE, "utf-8");
        const data: TunnelsFile = JSON.parse(content);
        return data.tunnels || [];
    } catch {
        return [];
    }
}

export async function saveTunnels(tunnels: TunnelConfig[]): Promise<void> {
    await ensureSshipDir();
    const data: TunnelsFile = { tunnels };
    await writeFile(TUNNELS_FILE, JSON.stringify(data, null, 2));
}

export async function addTunnel(tunnel: TunnelConfig): Promise<void> {
    const tunnels = await loadTunnels();
    const existing = tunnels.find((t) => t.name === tunnel.name);
    if (existing) {
        throw new Error(`Tunnel with name "${tunnel.name}" already exists`);
    }
    tunnels.push(tunnel);
    await saveTunnels(tunnels);
}

export async function getTunnel(name: string): Promise<TunnelConfig | undefined> {
    const tunnels = await loadTunnels();
    return tunnels.find((t) => t.name === name);
}

export async function updateTunnelPid(name: string, pid: number | undefined): Promise<void> {
    const tunnels = await loadTunnels();
    const tunnel = tunnels.find((t) => t.name === name);
    if (tunnel) {
        tunnel.pid = pid;
        await saveTunnels(tunnels);
    }
}

export async function deleteTunnel(name: string): Promise<void> {
    const tunnels = await loadTunnels();
    const filtered = tunnels.filter((t) => t.name !== name);
    if (filtered.length === tunnels.length) {
        throw new Error(`Tunnel "${name}" not found`);
    }
    await saveTunnels(filtered);
}

export async function clearDeadPids(): Promise<void> {
    const tunnels = await loadTunnels();
    let changed = false;

    for (const tunnel of tunnels) {
        if (tunnel.pid) {
            try {
                // Check if process is still running (signal 0 doesn't kill, just checks)
                process.kill(tunnel.pid, 0);
            } catch {
                // Process is dead, clear the PID
                tunnel.pid = undefined;
                changed = true;
            }
        }
    }

    if (changed) {
        await saveTunnels(tunnels);
    }
}
