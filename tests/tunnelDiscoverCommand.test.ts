import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "events";

const selectQueue: string[] = [];
const mockSelect = mock(async () => selectQueue.shift());
const mockInput = mock(async () => "my-tunnel");
const mockSearch = mock(async () => ({
    host: "127.0.0.1",
    port: 3000,
    process: "vite",
}));

const mockLoadServers = mock(async () => []);
const mockAddTunnel = mock(async () => {});
const mockUpdateTunnelPid = mock(async () => {});
const mockLogger = {
    info: () => {},
    fail: () => {},
    start: () => {},
    succeed: () => {},
    warn: () => {},
};

const mockSpawn = mock(() => {
    const child = new EventEmitter() as unknown as {
        stdout: EventEmitter;
        stderr: EventEmitter;
        stdin: { end: () => void; write: (chunk: string) => void };
        on: (event: string, cb: (...args: unknown[]) => void) => void;
        unref: () => void;
        pid?: number;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end() {}, write() {} };
    child.unref = () => {};
    child.pid = 12345;

    setTimeout(() => {
        child.stdout.emit(
            "data",
            "LISTEN 0 128 127.0.0.1:3000 0.0.0.0:* users:((\"node\",pid=1,fd=3))\n"
        );
        child.emit("close", 0);
    }, 0);

    return child;
});

const mockCreateServer = () => ({
    unref() {},
    on(event: string, cb: () => void) {
        if (event === "error") {
            return;
        }
        if (event === "listening") {
            cb();
        }
    },
    listen(_port: number, _host: string, cb: () => void) {
        cb();
    },
    close(cb: () => void) {
        cb();
    },
});

const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const storagePath = new URL("../src/utils/tunnelStorage.ts", import.meta.url).pathname;
const serverStoragePath = new URL("../src/utils/serverStorage.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(storagePath, () => ({
    loadTunnels: mock(async () => []),
    clearDeadPids: mock(async () => {}),
    getTunnel: mock(async () => null),
    addTunnel: mockAddTunnel,
    updateTunnelPid: mockUpdateTunnelPid,
    deleteTunnel: mock(async () => {}),
}));
mock.module(serverStoragePath, () => ({ loadServers: mockLoadServers }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module("@inquirer/prompts", () => ({ input: mockInput, search: mockSearch }));
mock.module("child_process", () => ({ spawn: mockSpawn }));
mock.module("fs/promises", () => ({
    readFile: mock(async () => "Host myserver"),
}));
mock.module("fs", () => ({ existsSync: () => true }));
mock.module("net", () => ({ createServer: mockCreateServer }));

import { discoverTunnelWizard } from "../src/commands/tunnel.ts";

describe("tunnel discover flow", () => {
    beforeEach(() => {
        selectQueue.length = 0;
        mockAddTunnel.mockClear();
        mockUpdateTunnelPid.mockClear();
        mockInput.mockClear();
        mockSearch.mockClear();
        mockInput.mockResolvedValue("my-tunnel");
    });

    test("discovers ports and creates tunnel", async () => {
        const originalKill = process.kill;
        (process as unknown as { kill: () => boolean }).kill = () => true;

        selectQueue.push("myserver");
        await discoverTunnelWizard();

        expect(mockAddTunnel).toHaveBeenCalled();
        expect(mockUpdateTunnelPid).toHaveBeenCalled();

        (process as unknown as { kill: typeof process.kill }).kill = originalKill;
    });
});
