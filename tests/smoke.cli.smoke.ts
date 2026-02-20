import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function ensureBuilt(): boolean {
    return existsSync(join(process.cwd(), "dist/index.js"));
}

function runCli(args: string[], homeDir: string, extraEnv?: Record<string, string>) {
    const result = spawnSync("node", ["dist/index.js", ...args], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            HOME: homeDir,
            BUN_TMPDIR: "/tmp",
            ...(extraEnv ?? {}),
        },
        stdio: "ignore",
        timeout: 15000,
    });

    return {
        code: result.status ?? 1,
        error: result.error,
    };
}

function readLog(homeDir: string): string {
    const path = join(homeDir, ".sship", "logs", "sship.log");
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf-8");
}

function readTunnels(homeDir: string): { tunnels: Array<{ name: string; pid?: number }> } {
    const path = join(homeDir, ".sship", "tunnels.json");
    return JSON.parse(readFileSync(path, "utf-8")) as { tunnels: Array<{ name: string; pid?: number }> };
}

describe("CLI smoke", () => {
    const tempHomes: string[] = [];

    beforeEach(() => {
        mock.restore();
    });

    afterEach(() => {
        while (tempHomes.length > 0) {
            const path = tempHomes.pop();
            if (path && existsSync(path)) {
                rmSync(path, { recursive: true, force: true });
            }
        }
    });

    test("shows help", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const result = runCli(["--help"], home);

        expect(result.error).toBeUndefined();
        expect(result.code).toBe(0);
    });

    test("list command works in clean HOME", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const result = runCli(["list"], home);

        expect(result.error).toBeUndefined();
        expect(result.code).toBe(0);
        expect(readLog(home)).toContain("No keys found");
    });

    test("doctor reports missing ssh config gracefully", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const result = runCli(["doctor"], home);

        expect(result.error).toBeUndefined();
        expect(result.code).toBe(0);
        expect(readLog(home)).toContain("SSH config file not found");
    });

    test("restore reports missing archive gracefully", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const result = runCli(["restore", "--dry-run"], home);

        expect(result.error).toBeUndefined();
        expect(result.code).toBe(0);
        expect(readLog(home)).toContain("No backup archive found");
    });

    test("tunnel subcommands handle empty storage", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const listResult = runCli(["tunnel", "list"], home);
        expect(listResult.error).toBeUndefined();
        expect(listResult.code).toBe(0);
        expect(readLog(home)).toContain("No tunnels configured");

        const startResult = runCli(["tunnel", "start", "missing"], home);
        expect(startResult.error).toBeUndefined();
        expect(startResult.code).toBe(0);
        expect(readLog(home)).toContain('Tunnel "missing" not found');
    });

    test("delete command reports empty service key store", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const result = runCli(["delete", "missing", "-y"], home);
        expect(result.error).toBeUndefined();
        expect(result.code).toBe(0);
        expect(readLog(home)).toContain("No keys found to delete");
    });

    test("servers subcommands add/list/delete lifecycle works", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        const pemPath = join(home, "demo.pem");
        writeFileSync(pemPath, "FAKE-PEM", "utf-8");
        chmodSync(pemPath, 0o600);

        const addResult = runCli(
            ["servers", "add", "-n", "demo", "-H", "127.0.0.1", "-u", "ubuntu", "-k", pemPath, "--no-copy"],
            home
        );
        expect(addResult.error).toBeUndefined();
        expect(addResult.code).toBe(0);

        const listResult = runCli(["servers", "list"], home);
        expect(listResult.error).toBeUndefined();
        expect(listResult.code).toBe(0);
        expect(readLog(home)).toContain("Configured servers");

        const deleteResult = runCli(["servers", "delete", "demo", "--yes"], home);
        expect(deleteResult.error).toBeUndefined();
        expect(deleteResult.code).toBe(0);
        expect(readLog(home)).toContain('Server "demo" deleted successfully!');
    });

    test("tunnel start and stop lifecycle works with stubbed ssh", () => {
        if (!ensureBuilt()) return;

        const home = mkdtempSync(join(tmpdir(), "sship-smoke-home-"));
        tempHomes.push(home);

        mkdirSync(join(home, ".sship"), { recursive: true });
        writeFileSync(
            join(home, ".sship", "tunnels.json"),
            JSON.stringify(
                {
                    tunnels: [
                        {
                            name: "demo",
                            type: "local",
                            server: "example",
                            localPort: 15432,
                            remoteHost: "127.0.0.1",
                            remotePort: 5432,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                },
                null,
                2
            ),
            "utf-8"
        );

        const binDir = join(home, "bin");
        mkdirSync(binDir, { recursive: true });
        const sshStub = join(binDir, "ssh");
        writeFileSync(sshStub, "#!/usr/bin/env sh\nsleep 30\n", "utf-8");
        chmodSync(sshStub, 0o755);

        const env = { PATH: `${binDir}:${process.env.PATH ?? ""}` };

        const startResult = runCli(["tunnel", "start", "demo"], home, env);
        expect(startResult.error).toBeUndefined();
        expect(startResult.code).toBe(0);
        expect(readLog(home)).toContain('Tunnel "demo" started!');

        const started = readTunnels(home);
        const runningTunnel = started.tunnels.find((t) => t.name === "demo");
        expect(typeof runningTunnel?.pid).toBe("number");

        const stopResult = runCli(["tunnel", "stop", "demo"], home, env);
        expect(stopResult.error).toBeUndefined();
        expect(stopResult.code).toBe(0);
        expect(readLog(home)).toContain('Tunnel "demo" stopped');

        const stopped = readTunnels(home);
        const stoppedTunnel = stopped.tunnels.find((t) => t.name === "demo");
        expect(stoppedTunnel?.pid).toBeUndefined();
    });
});
