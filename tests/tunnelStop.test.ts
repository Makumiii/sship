import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockGetTunnel = mock(async () => undefined as undefined | { name: string; pid?: number });
const mockUpdateTunnelPid = mock(async () => {});

const mockLogger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

const storagePath = new URL("../src/utils/tunnelStorage.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(storagePath, () => ({
    loadTunnels: mock(async () => []),
    addTunnel: mock(async () => {}),
    getTunnel: mockGetTunnel,
    updateTunnelPid: mockUpdateTunnelPid,
    deleteTunnel: mock(async () => {}),
    clearDeadPids: mock(async () => {}),
}));
mock.module(loggerPath, () => ({ logger: mockLogger }));

import { stopTunnel } from "../src/commands/tunnel.ts";

describe("stopTunnel", () => {
    beforeEach(() => {
        mockGetTunnel.mockClear();
        mockUpdateTunnelPid.mockClear();
        mockLogger.fail.mockClear();
        mockLogger.warn.mockClear();
    });

    test("returns false when tunnel is missing", async () => {
        mockGetTunnel.mockResolvedValue(undefined);

        const result = await stopTunnel("missing");

        expect(result).toBe(false);
        expect(mockLogger.fail).toHaveBeenCalledWith('Tunnel "missing" not found');
    });

    test("returns false when tunnel is not running", async () => {
        mockGetTunnel.mockResolvedValue({ name: "db", pid: undefined });

        const result = await stopTunnel("db");

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Tunnel "db" is not running');
    });

    test("clears pid when tunnel is running", async () => {
        mockGetTunnel.mockResolvedValue({ name: "db", pid: 4444 });

        const originalKill = process.kill;
        (process as unknown as { kill: typeof process.kill }).kill = (() => true) as unknown as typeof process.kill;

        const result = await stopTunnel("db");

        expect(result).toBe(true);
        expect(mockUpdateTunnelPid).toHaveBeenCalledWith("db", undefined);

        (process as unknown as { kill: typeof process.kill }).kill = originalKill;
    });
});
