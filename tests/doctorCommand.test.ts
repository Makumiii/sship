import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockReadFile = mock(async () => "");
const mockAccess = mock(async () => {});
const mockWriteFile = mock(async () => {});
const mockCopyFile = mock(async () => {});
const mockSelect = mock(async () => "No");
const mockDeleteKeyAlias = mock(async () => {});
const mockExistsSync = mock(() => false);
const mockLoadServiceKeys = mock(async () => []);
const mockRemoveServiceKey = mock(async () => {});
const mockLoadServers = mock(async () => []);
const mockDeleteServer = mock(async () => {});
const mockLoadTunnels = mock(async () => []);
const mockClearDeadPids = mock(async () => {});

const mockLogger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;
const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const deleteKeyPath = new URL("../src/commands/deleteKey.ts", import.meta.url).pathname;
const serviceKeysPath = new URL("../src/utils/serviceKeys.ts", import.meta.url).pathname;
const serverStoragePath = new URL("../src/utils/serverStorage.ts", import.meta.url).pathname;
const tunnelStoragePath = new URL("../src/utils/tunnelStorage.ts", import.meta.url).pathname;

mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(deleteKeyPath, () => ({ deleteKeyAlias: mockDeleteKeyAlias }));
mock.module(serviceKeysPath, () => ({
    loadServiceKeys: mockLoadServiceKeys,
    removeServiceKey: mockRemoveServiceKey,
}));
mock.module(serverStoragePath, () => ({
    loadServers: mockLoadServers,
    deleteServer: mockDeleteServer,
}));
mock.module(tunnelStoragePath, () => ({
    loadTunnels: mockLoadTunnels,
    clearDeadPids: mockClearDeadPids,
}));
mock.module("node:os", () => ({ homedir: () => "/mock/home" }));
mock.module("node:fs", () => ({ existsSync: mockExistsSync }));
mock.module("node:fs/promises", () => ({
    readFile: mockReadFile,
    access: mockAccess,
    writeFile: mockWriteFile,
    copyFile: mockCopyFile,
}));

import doctorCommand, { parseSshConfig } from "../src/commands/doctor.ts";

describe("doctor command", () => {
    beforeEach(() => {
        mockReadFile.mockClear();
        mockAccess.mockClear();
        mockSelect.mockClear();
        mockDeleteKeyAlias.mockClear();
        mockExistsSync.mockClear();
        mockLoadServiceKeys.mockClear();
        mockRemoveServiceKey.mockClear();
        mockLoadServers.mockClear();
        mockDeleteServer.mockClear();
        mockLoadTunnels.mockClear();
        mockClearDeadPids.mockClear();
        mockWriteFile.mockClear();
        mockCopyFile.mockClear();
        mockLogger.info.mockClear();
        mockLogger.fail.mockClear();
        mockLogger.start.mockClear();
        mockLogger.succeed.mockClear();
    });

    test("parseSshConfig parses host and identity blocks", async () => {
        mockReadFile.mockResolvedValueOnce(
            `Host github
  IdentityFile /mock/home/.ssh/github
Host staging
  User ubuntu
`
        );

        const entries = await parseSshConfig();

        expect(entries).toEqual([
            { host: "github", identityFile: "/mock/home/.ssh/github" },
            { host: "staging", identityFile: undefined },
        ]);
    });

    test("reports healthy config when all identity files exist", async () => {
        mockReadFile.mockResolvedValueOnce(`Host github
  IdentityFile /mock/home/.ssh/github
`);
        mockAccess.mockResolvedValue(undefined);

        await doctorCommand();

        expect(mockLogger.succeed).toHaveBeenCalledWith(
            "No missing SSH key files found in your config. Your SSH config is healthy!"
        );
        expect(mockSelect).not.toHaveBeenCalled();
    });

    test("prompts for deletion and removes missing host entry", async () => {
        mockReadFile.mockResolvedValueOnce(`Host old-host
  IdentityFile /mock/home/.ssh/missing
`);
        mockAccess.mockRejectedValueOnce(new Error("ENOENT"));
        mockSelect.mockResolvedValueOnce("Yes");

        await doctorCommand();

        expect(mockSelect).toHaveBeenCalled();
        const deleteArg = (mockDeleteKeyAlias.mock.calls[0] as unknown as [string])[0];
        expect(deleteArg).toBe("old-host");
        expect(mockLogger.info).toHaveBeenCalledWith("Deleted config entry for host 'old-host'.");
    });

    test("fix-all prunes broken references without prompting", async () => {
        mockReadFile.mockResolvedValueOnce(`Host stale
  IdentityFile /mock/home/.ssh/missing
`);
        mockAccess.mockRejectedValue(new Error("ENOENT"));
        mockLoadServiceKeys.mockResolvedValueOnce(["ghost-key"]);
        mockLoadServers.mockResolvedValueOnce([
            {
                name: "broken-server",
                host: "1.1.1.1",
                port: 22,
                user: "root",
                authMode: "identity_file",
                identityFile: "/mock/home/.ssh/missing.pem",
                createdAt: new Date().toISOString(),
            },
        ]);
        mockLoadTunnels.mockResolvedValueOnce([{ name: "t1", pid: 1234 }]);

        await doctorCommand({ fixAll: true });

        expect(mockSelect).not.toHaveBeenCalled();
        expect(mockDeleteKeyAlias).toHaveBeenCalledWith("stale");
        expect(mockRemoveServiceKey).toHaveBeenCalledWith("ghost-key");
        expect(mockDeleteServer).toHaveBeenCalledWith("broken-server");
        expect(mockClearDeadPids).toHaveBeenCalled();
    });
});
