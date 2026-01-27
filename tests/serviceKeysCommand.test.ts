import { describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "events";

const selectQueue: string[] = [];
const mockSelect = mock(async () => selectQueue.shift());
const mockLoadServiceKeys = mock(async () => ["github-test"]);
const mockGetAllFiles = mock(() => ["github-test", "github-test.pub"]);
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
        on: (event: string, cb: (...args: unknown[]) => void) => void;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setTimeout(() => {
        child.emit("close", 0);
    }, 0);
    return child;
});

const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const serviceKeysPath = new URL("../src/utils/serviceKeys.ts", import.meta.url).pathname;
const filesPath = new URL("../src/utils/getAllFiles.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(serviceKeysPath, () => ({
    loadServiceKeys: mockLoadServiceKeys,
    addServiceKey: mock(async () => {}),
    removeServiceKey: mock(async () => {}),
}));
mock.module(filesPath, () => ({ getAllFiles: mockGetAllFiles }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module("child_process", () => ({ spawn: mockSpawn }));

import { manageServiceKeys } from "../src/commands/serviceKeys.ts";

describe("service keys command", () => {
    test("runs connection test for selected key", async () => {
        selectQueue.push("list", "github-test", "test");
        await manageServiceKeys();
        expect(mockSpawn).toHaveBeenCalled();
        const args = (mockSpawn.mock.calls[0] as unknown as [string, string[]])[1];
        expect(args).toContain("github-test");
        expect(args).toContain("-T");
    });
});
