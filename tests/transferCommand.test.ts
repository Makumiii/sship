import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockStartTransferServerWithFallback = mock(async () => 3847);
const mockGetTransferPort = mock(() => 3847);
const mockSpawn = mock(() => ({ unref: () => {} }));

const mockLogger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

const transferServerPath = new URL("../src/transfer/server.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(transferServerPath, () => ({
    startTransferServerWithFallback: mockStartTransferServerWithFallback,
    getTransferPort: mockGetTransferPort,
}));
mock.module("child_process", () => ({ spawn: mockSpawn }));
mock.module("os", () => ({ platform: () => "linux" }));
mock.module(loggerPath, () => ({ logger: mockLogger }));

import { transferCommand } from "../src/commands/transfer.ts";

describe("transfer command", () => {
    beforeEach(() => {
        mockStartTransferServerWithFallback.mockClear();
        mockGetTransferPort.mockClear();
        mockSpawn.mockClear();
        mockLogger.info.mockClear();
        mockLogger.fail.mockClear();
    });

    test("starts transfer server and attempts to open browser", async () => {
        mockGetTransferPort.mockReturnValueOnce(3850);
        transferCommand();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockStartTransferServerWithFallback).toHaveBeenCalled();
        expect(mockSpawn).toHaveBeenCalledWith("xdg-open", ["http://localhost:3850"], {
            detached: true,
            stdio: "ignore",
        });
        expect(mockLogger.info).toHaveBeenCalledWith("Press Ctrl+C to stop the file transfer server.");
    });

    test("logs fallback message if browser opener fails", async () => {
        mockSpawn.mockImplementationOnce(() => {
            throw new Error("open failed");
        });

        transferCommand();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockLogger.info).toHaveBeenCalledWith(
            "Could not automatically open browser. Please visit: http://localhost:3847"
        );
    });

    test("logs startup failure when transfer server cannot start", async () => {
        mockStartTransferServerWithFallback.mockImplementationOnce(async () => {
            throw new Error("listen EADDRINUSE: address already in use 0.0.0.0:3847");
        });

        await transferCommand();

        expect(mockLogger.fail).toHaveBeenCalledWith(
            "Failed to start file transfer: listen EADDRINUSE: address already in use 0.0.0.0:3847"
        );
    });
});
