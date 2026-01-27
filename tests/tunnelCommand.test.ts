import { describe, expect, mock, test } from "bun:test";

const selectQueue: string[] = [];
const mockSelect = mock(async () => selectQueue.shift());
const mockLoadTunnels = mock(async () => []);
const mockClearDeadPids = mock(async () => {});
const mockLogger = {
    info: () => {},
    fail: () => {},
    start: () => {},
    succeed: () => {},
    warn: () => {},
};

const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const storagePath = new URL("../src/utils/tunnelStorage.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(storagePath, () => ({
    loadTunnels: mockLoadTunnels,
    clearDeadPids: mockClearDeadPids,
    getTunnel: mock(async () => null),
    addTunnel: mock(async () => {}),
    updateTunnelPid: mock(async () => {}),
    deleteTunnel: mock(async () => {}),
}));
mock.module(loggerPath, () => ({ logger: mockLogger }));

import { tunnelCommand } from "../src/commands/tunnel.ts";

describe("tunnel command", () => {
    test("routes manage flow and loads tunnels", async () => {
        selectQueue.push("manage");
        await tunnelCommand();
        expect(mockLoadTunnels).toHaveBeenCalled();
    });
});
