import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockPromptUser = mock(async () => ({ passphrase: "typed-pass" }));
const mockRunCommand = mock(async () => 0);
const mockReaddir = mock(async () => [] as Array<{ name: string; isFile: () => boolean }>);
const mockCopyFile = mock(async () => {});
const mockMkdtemp = mock(async () => "/tmp/sship-backup-abc123");
const mockExistsSync = mock(() => true);

const mockLogger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

const promptPath = new URL("../src/utils/prompt.ts", import.meta.url).pathname;
const commandPath = new URL("../src/utils/command.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(promptPath, () => ({ promptUser: mockPromptUser }));
mock.module(commandPath, () => ({ runCommand: mockRunCommand }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module("node:os", () => ({ homedir: () => "/mock/home", tmpdir: () => "/tmp" }));
mock.module("node:fs", () => ({ existsSync: mockExistsSync }));
mock.module("fs/promises", () => ({
    readdir: mockReaddir,
    copyFile: mockCopyFile,
    mkdtemp: mockMkdtemp,
}));

import backupCommand from "../src/commands/backup.ts";

describe("backup command", () => {
    beforeEach(() => {
        mockPromptUser.mockClear();
        mockRunCommand.mockClear();
        mockReaddir.mockClear();
        mockCopyFile.mockClear();
        mockMkdtemp.mockClear();
        mockExistsSync.mockClear();
        mockLogger.start.mockClear();
        mockLogger.succeed.mockClear();
    });

    test("skips backup when no files exist", async () => {
        mockReaddir.mockResolvedValue([]);

        await backupCommand();

        expect(mockPromptUser).toHaveBeenCalled();
        expect(mockRunCommand).not.toHaveBeenCalled();
        expect(mockLogger.succeed).toHaveBeenCalledWith("No files found in ~/.ssh to back up.");
    });

    test("copies all regular ssh files and invokes backup script", async () => {
        mockReaddir.mockResolvedValue([
            { name: "id_ed25519", isFile: () => true },
            { name: "notes.txt", isFile: () => true },
            { name: "pem-folder", isFile: () => false },
            { name: "config", isFile: () => true },
        ]);

        await backupCommand({ passphrase: "cli-pass" });

        expect(mockPromptUser).not.toHaveBeenCalled();

        const copyCalls = mockCopyFile.mock.calls as unknown as Array<[string, string]>;
        expect(copyCalls.some(([src, dest]) =>
            src.endsWith("/.ssh/id_ed25519") && dest === "/tmp/sship-backup-abc123/id_ed25519"
        )).toBe(true);
        expect(copyCalls.some(([src, dest]) =>
            src.endsWith("/.ssh/config") && dest === "/tmp/sship-backup-abc123/config"
        )).toBe(true);
        expect(copyCalls.some(([src, dest]) =>
            src.endsWith("/.ssh/notes.txt") && dest === "/tmp/sship-backup-abc123/notes.txt"
        )).toBe(true);
        expect(copyCalls.some(([src]) => src.includes("pem-folder"))).toBe(false);

        expect(mockRunCommand).toHaveBeenCalled();
        const args = mockRunCommand.mock.calls[0] as unknown as [string, string[]];
        expect(args[1]).toEqual(["/tmp/sship-backup-abc123", "cli-pass"]);
    });

    test("returns cleanly when ~/.ssh directory does not exist", async () => {
        mockExistsSync.mockReturnValueOnce(false);

        await backupCommand({ passphrase: "cli-pass" });

        expect(mockReaddir).not.toHaveBeenCalled();
        expect(mockRunCommand).not.toHaveBeenCalled();
        expect(mockLogger.succeed).toHaveBeenCalledWith("No files found in ~/.ssh to back up.");
    });

    test("does not prompt when empty passphrase is provided explicitly", async () => {
        mockReaddir.mockResolvedValue([{ name: "config", isFile: () => true }]);

        await backupCommand({ passphrase: "" });

        expect(mockPromptUser).not.toHaveBeenCalled();
        const args = mockRunCommand.mock.calls[0] as unknown as [string, string[]];
        expect(args[1]).toEqual(["/tmp/sship-backup-abc123", ""]);
    });
});
