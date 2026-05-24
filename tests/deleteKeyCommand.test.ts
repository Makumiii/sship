import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockLoadServiceKeys = mock(async () => ["alpha"] as string[]);
const mockRemoveServiceKey = mock(async () => {});
const mockGetAllFiles = mock(() => ["alpha", "alpha.pub", "other"] as string[]);
const mockRemoveServiceKeyFromSshConfig = mock(async () => true);
const mockUnlinkSync = mock(() => {});
const mockExistsSync = mock(() => false);
const mockReadFileSync = mock(() => JSON.stringify({ version: "0.0.0-test" }));

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
const sshConfigPath = new URL("../src/utils/sshConfig.ts", import.meta.url).pathname;

mock.module(serviceKeysPath, () => ({
    loadServiceKeys: mockLoadServiceKeys,
    removeServiceKey: mockRemoveServiceKey,
}));
mock.module(allFilesPath, () => ({ getAllFiles: mockGetAllFiles }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module(selectPath, () => ({ select: mock(async () => "Yes") }));
mock.module(sshConfigPath, () => ({
    removeServiceKeyFromSshConfig: mockRemoveServiceKeyFromSshConfig,
    repairServiceKeySshConfig: mock(async () => ({ repaired: false })),
}));
mock.module("node:fs", () => ({
    unlinkSync: mockUnlinkSync,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    constants: { F_OK: 0 },
}));
mock.module("node:os", () => ({ homedir: () => "/mock/home", platform: () => "linux" }));

describe("delete key command", () => {
    beforeEach(() => {
        mockLoadServiceKeys.mockClear();
        mockRemoveServiceKey.mockClear();
        mockGetAllFiles.mockClear();
        mockRemoveServiceKeyFromSshConfig.mockClear();
        mockRemoveServiceKeyFromSshConfig.mockResolvedValue(true);
        mockUnlinkSync.mockClear();
        mockExistsSync.mockClear();
        mockReadFileSync.mockClear();
        mockLogger.info.mockClear();
        mockLogger.fail.mockClear();
    });

    test("deletes selected key files and removes alias/store entry", async () => {
        const { default: deleteCommand } = await import(`../src/commands/deleteKey.ts?test=${Date.now()}`);
        await deleteCommand("alpha", true);

        expect(mockGetAllFiles).toHaveBeenCalledWith("/mock/home/.ssh");
        const unlinkCalls = mockUnlinkSync.mock.calls as unknown as Array<[string]>;
        expect(unlinkCalls).toContainEqual(["/mock/home/.ssh/alpha"]);
        expect(unlinkCalls).toContainEqual(["/mock/home/.ssh/alpha.pub"]);
        expect(mockRemoveServiceKeyFromSshConfig).toHaveBeenCalledWith("alpha");
        expect(mockRemoveServiceKey).toHaveBeenCalledWith("alpha");
    });

    test("fails gracefully when key argument does not exist", async () => {
        const { default: deleteCommand } = await import(`../src/commands/deleteKey.ts?test=${Date.now()}`);
        await deleteCommand("missing", true);

        expect(mockLogger.fail).toHaveBeenCalledWith("Key 'missing' not found.");
        expect(mockUnlinkSync).not.toHaveBeenCalled();
        expect(mockRemoveServiceKey).not.toHaveBeenCalled();
    });
});
