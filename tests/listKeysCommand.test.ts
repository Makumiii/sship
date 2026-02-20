import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockLoadServiceKeys = mock(async () => [] as string[]);
const mockGetAllFiles = mock(() => [] as string[]);
const mockExistsSync = mock(() => false);
const mockReadFileSync = mock(() => "");
const mockCopyToClipboard = mock(() => true);

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
const clipboardPath = new URL("../src/utils/clipboard.ts", import.meta.url).pathname;

mock.module(serviceKeysPath, () => ({ loadServiceKeys: mockLoadServiceKeys }));
mock.module(allFilesPath, () => ({ getAllFiles: mockGetAllFiles }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module(selectPath, () => ({ select: mock(async () => "__back__") }));
mock.module(clipboardPath, () => ({ copyToClipboard: mockCopyToClipboard }));
mock.module("node:fs", () => ({
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
}));

import listKeysCommand from "../src/commands/listKeys.ts";

describe("list keys command", () => {
    beforeEach(() => {
        mockLoadServiceKeys.mockClear();
        mockGetAllFiles.mockClear();
        mockExistsSync.mockClear();
        mockLogger.info.mockClear();
        mockLogger.fail.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.succeed.mockClear();
    });

    test("returns cleanly when ~/.ssh does not exist", async () => {
        mockExistsSync.mockReturnValue(false);

        await listKeysCommand();

        expect(mockGetAllFiles).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith("No keys found");
    });

    test("returns no keys when store is empty", async () => {
        mockExistsSync.mockReturnValue(true);
        mockGetAllFiles.mockReturnValue(["id_rsa", "id_rsa.pub"]);
        mockLoadServiceKeys.mockResolvedValue([]);

        await listKeysCommand();

        expect(mockGetAllFiles).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith("No keys found");
    });
});
