import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TunnelConfig } from "../src/types/tunnelTypes.ts";

type TunnelStorageModule = typeof import("../src/utils/tunnelStorage.ts");

let originalHome = process.env.HOME;
let testHome = "";

async function loadStorageModule(): Promise<TunnelStorageModule> {
    mock.module("node:os", () => ({ homedir: () => testHome }));
    return import(`../src/utils/tunnelStorage.ts?t=${Date.now()}-${Math.random()}`);
}

function tunnelsFilePath(home: string): string {
    return join(home, ".sship", "tunnels.json");
}

describe("tunnel storage", () => {
    const tunnel: TunnelConfig = {
        name: "db-dev",
        type: "local",
        server: "dev-box",
        localPort: 15432,
        remoteHost: "127.0.0.1",
        remotePort: 5432,
        createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
        mock.restore();
        testHome = mkdtempSync(join(tmpdir(), "sship-tunnel-store-"));
        process.env.HOME = testHome;
    });

    afterEach(() => {
        process.env.HOME = originalHome;
        if (testHome && existsSync(testHome)) {
            rmSync(testHome, { recursive: true, force: true });
        }
        testHome = "";
    });

    test("loadTunnels returns empty when file is invalid", async () => {
        const filePath = tunnelsFilePath(testHome);
        await mkdir(join(testHome, ".sship"), { recursive: true });
        await writeFile(filePath, "broken-json", "utf-8");

        const storage = await loadStorageModule();
        const result = await storage.loadTunnels();

        expect(result).toEqual([]);
    });

    test("addTunnel saves a new tunnel", async () => {
        const storage = await loadStorageModule();
        await storage.addTunnel(tunnel);

        const raw = await readFile(tunnelsFilePath(testHome), "utf-8");
        expect(raw).toContain("db-dev");
        expect(raw).toContain("15432");
    });

    test("addTunnel throws for duplicate names", async () => {
        const storage = await loadStorageModule();
        await storage.addTunnel(tunnel);
        expect(storage.addTunnel(tunnel)).rejects.toThrow('Tunnel with name "db-dev" already exists');
    });

    test("getTunnel finds tunnel by name", async () => {
        const storage = await loadStorageModule();
        await storage.addTunnel(tunnel);

        const result = await storage.getTunnel("db-dev");
        expect(result?.name).toBe("db-dev");
    });

    test("updateTunnelPid updates pid for existing tunnel", async () => {
        const storage = await loadStorageModule();
        await storage.addTunnel(tunnel);

        await storage.updateTunnelPid("db-dev", 4321);

        const raw = await readFile(tunnelsFilePath(testHome), "utf-8");
        const payload = JSON.parse(raw) as { tunnels: Array<{ name: string; pid?: number }> };
        const updated = payload.tunnels.find((t) => t.name === "db-dev");
        expect(updated?.pid).toBe(4321);
    });

    test("deleteTunnel throws when tunnel is missing", async () => {
        const storage = await loadStorageModule();
        await storage.addTunnel(tunnel);

        expect(storage.deleteTunnel("missing")).rejects.toThrow('Tunnel "missing" not found');
    });

    test("clearDeadPids clears pid for dead processes", async () => {
        const storage = await loadStorageModule();
        await storage.addTunnel({ ...tunnel, pid: 99999 });
        await storage.addTunnel({ ...tunnel, name: "alive", localPort: 18080, pid: 12345 });

        const originalKill = process.kill;
        (process as unknown as { kill: typeof process.kill }).kill = ((pid: number) => {
            if (pid === 99999) {
                throw new Error("ESRCH");
            }
            return true;
        }) as unknown as typeof process.kill;

        await storage.clearDeadPids();

        const raw = await readFile(tunnelsFilePath(testHome), "utf-8");
        const payload = JSON.parse(raw) as { tunnels: Array<{ name: string; pid?: number }> };
        const dead = payload.tunnels.find((t) => t.name === "db-dev");
        const alive = payload.tunnels.find((t) => t.name === "alive");

        expect(dead?.pid).toBeUndefined();
        expect(alive?.pid).toBe(12345);

        (process as unknown as { kill: typeof process.kill }).kill = originalKill;
    });
});
