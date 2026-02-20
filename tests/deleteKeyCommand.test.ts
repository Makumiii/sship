import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockLoadServiceKeys = mock(async () => ["alpha"] as string[]);
const mockRemoveServiceKey = mock(async () => {});
const mockGetAllFiles = mock(() => ["alpha", "alpha.pub", "other"] as string[]);
const mockReadFile = mock(async () => "Host alpha\n  IdentityFile ~/.ssh/alpha\nHost beta\n  IdentityFile ~/.ssh/beta\n");
const mockWriteFile = mock(async () => {});
const mockUnlinkSync = mock(() => {});

const mockLogger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

const serviceKeysPath = new URL("../src/utils/serviceKeys.ts", import.meta.url).pathname;
const allFilesPath = new URL("../src/utils/getAllFiles.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;
const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;

mock.module(serviceKeysPath, () => ({
    loadServiceKeys: mockLoadServiceKeys,
    removeServiceKey: mockRemoveServiceKey,
}));
mock.module(allFilesPath, () => ({ getAllFiles: mockGetAllFiles }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module(selectPath, () => ({ select: mock(async () => "Yes") }));
mock.module("node:fs", () => ({ unlinkSync: mockUnlinkSync }));
mock.module("node:os", () => ({ homedir: () => "/mock/home" }));
mock.module("fs/promises", () => ({
    readFile: mockReadFile,
    writeFile: mockWriteFile,
}));

import deleteCommand from "../src/commands/deleteKey.ts";

describe("delete key command", () => {
    beforeEach(() => {
        mockLoadServiceKeys.mockClear();
        mockRemoveServiceKey.mockClear();
        mockGetAllFiles.mockClear();
        mockReadFile.mockClear();
        mockWriteFile.mockClear();
        mockUnlinkSync.mockClear();
        mockLogger.info.mockClear();
        mockLogger.fail.mockClear();
    });

    test("deletes selected key files and removes alias/store entry", async () => {
        await deleteCommand("alpha", true);

        expect(mockGetAllFiles).toHaveBeenCalledWith("/mock/home/.ssh");
        const unlinkCalls = mockUnlinkSync.mock.calls as unknown as Array<[string]>;
        expect(unlinkCalls).toContainEqual(["/mock/home/.ssh/alpha"]);
        expect(unlinkCalls).toContainEqual(["/mock/home/.ssh/alpha.pub"]);
        expect(mockWriteFile).toHaveBeenCalled();
        expect(mockRemoveServiceKey).toHaveBeenCalledWith("alpha");
    });

    test("fails gracefully when key argument does not exist", async () => {
        await deleteCommand("missing", true);

        expect(mockLogger.fail).toHaveBeenCalledWith("Key 'missing' not found.");
        expect(mockUnlinkSync).not.toHaveBeenCalled();
        expect(mockRemoveServiceKey).not.toHaveBeenCalled();
    });
});
