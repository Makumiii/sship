import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const serviceKeysPath = new URL("../src/commands/serviceKeys.ts", import.meta.url).pathname;
const backupPath = new URL("../src/commands/backup.ts", import.meta.url).pathname;
const doctorPath = new URL("../src/commands/doctor.ts", import.meta.url).pathname;
const onboardPath = new URL("../src/commands/onboard.ts", import.meta.url).pathname;
const serversPath = new URL("../src/commands/servers.ts", import.meta.url).pathname;
const transferPath = new URL("../src/commands/transfer.ts", import.meta.url).pathname;
const tunnelPath = new URL("../src/commands/tunnel.ts", import.meta.url).pathname;
const restorePath = new URL("../src/commands/restore.ts", import.meta.url).pathname;
const commandUtilPath = new URL("../src/utils/command.ts", import.meta.url).pathname;

const cliCreatePath = new URL("../src/cli-commands/create.ts", import.meta.url).pathname;
const cliDeletePath = new URL("../src/cli-commands/delete.ts", import.meta.url).pathname;
const cliListPath = new URL("../src/cli-commands/list.ts", import.meta.url).pathname;
const cliBackupPath = new URL("../src/cli-commands/backup.ts", import.meta.url).pathname;
const cliUninstallPath = new URL("../src/cli-commands/uninstall.ts", import.meta.url).pathname;
const cliDoctorPath = new URL("../src/cli-commands/doctor.ts", import.meta.url).pathname;
const cliServersPath = new URL("../src/cli-commands/servers.ts", import.meta.url).pathname;
const cliTransferPath = new URL("../src/cli-commands/transfer.ts", import.meta.url).pathname;
const cliTunnelPath = new URL("../src/cli-commands/tunnel.ts", import.meta.url).pathname;
const cliRestorePath = new URL("../src/cli-commands/restore.ts", import.meta.url).pathname;

const logger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

const mockSelect = mock(async () => "exit");
const mockManageServiceKeys = mock(async () => {});
const mockBackup = mock(async () => {});
const mockDoctor = mock(async () => {});
const mockOnboard = mock(async () => {});
const mockServers = mock(async () => {});
const mockTransfer = mock(async () => {});
const mockTunnel = mock(async () => {});
const mockRestore = mock(async () => {});
const mockRunCommand = mock(async () => {});

const mockRegisterCreate = mock(() => {});
const mockRegisterDelete = mock(() => {});
const mockRegisterList = mock(() => {});
const mockRegisterBackup = mock(() => {});
const mockRegisterUninstall = mock(() => {});
const mockRegisterDoctor = mock(() => {});
const mockRegisterServers = mock(() => {});
const mockRegisterTransfer = mock(() => {});
const mockRegisterTunnel = mock(() => {});
const mockRegisterRestore = mock(() => {});

const parseMock = mock(() => {});

function mockCommonInteractiveDeps() {
    mock.module(selectPath, () => ({ select: mockSelect }));
    mock.module(serviceKeysPath, () => ({ manageServiceKeys: mockManageServiceKeys }));
    mock.module(backupPath, () => ({ default: mockBackup }));
    mock.module(doctorPath, () => ({ default: mockDoctor }));
    mock.module(onboardPath, () => ({ default: mockOnboard }));
    mock.module(serversPath, () => ({ serversCommand: mockServers }));
    mock.module(transferPath, () => ({ transferCommand: mockTransfer }));
    mock.module(tunnelPath, () => ({ tunnelCommand: mockTunnel }));
    mock.module(restorePath, () => ({ default: mockRestore }));
    mock.module(commandUtilPath, () => ({ runCommand: mockRunCommand }));
    mock.module(new URL("../src/utils/logger.ts", import.meta.url).pathname, () => ({ logger }));
}

function mockCliDeps() {
    mock.module(cliCreatePath, () => ({ registerCreateCommand: mockRegisterCreate }));
    mock.module(cliDeletePath, () => ({ registerDeleteCommand: mockRegisterDelete }));
    mock.module(cliListPath, () => ({ registerListCommand: mockRegisterList }));
    mock.module(cliBackupPath, () => ({ registerBackupCommand: mockRegisterBackup }));
    mock.module(cliUninstallPath, () => ({ registerUninstallCommand: mockRegisterUninstall }));
    mock.module(cliDoctorPath, () => ({ registerDoctorCommand: mockRegisterDoctor }));
    mock.module(cliServersPath, () => ({ registerServersCommand: mockRegisterServers }));
    mock.module(cliTransferPath, () => ({ registerTransferCommand: mockRegisterTransfer }));
    mock.module(cliTunnelPath, () => ({ registerTunnelCommand: mockRegisterTunnel }));
    mock.module(cliRestorePath, () => ({ registerRestoreCommand: mockRegisterRestore }));

    mock.module("commander", () => ({
        Command: class {
            name() { return this; }
            description() { return this; }
            version() { return this; }
            parse(argv: string[]) { parseMock(argv); return this; }
        },
    }));

    mock.module("fs", async (importOriginal) => {
        const original = await importOriginal();
        return {
            ...original,
            readFileSync: () => JSON.stringify({ version: "0.0.0-test" }),
        };
    });
}

describe("index entry flows", () => {
    const originalArgv = process.argv.slice();
    const originalExit = process.exit;

    beforeEach(() => {
        mock.restore();
        process.argv = originalArgv.slice();

        mockSelect.mockClear();
        mockManageServiceKeys.mockClear();
        mockBackup.mockClear();
        mockDoctor.mockClear();
        mockOnboard.mockClear();
        mockServers.mockClear();
        mockTransfer.mockClear();
        mockTunnel.mockClear();
        mockRestore.mockClear();
        mockRunCommand.mockClear();

        logger.info.mockClear();
        logger.fail.mockClear();

        parseMock.mockClear();
        mockRegisterCreate.mockClear();
        mockRegisterDelete.mockClear();
        mockRegisterList.mockClear();
        mockRegisterBackup.mockClear();
        mockRegisterUninstall.mockClear();
        mockRegisterDoctor.mockClear();
        mockRegisterServers.mockClear();
        mockRegisterTransfer.mockClear();
        mockRegisterTunnel.mockClear();
        mockRegisterRestore.mockClear();

        (process as unknown as { exit: typeof process.exit }).exit = mock((() => undefined) as never);
    });

    afterEach(() => {
        process.argv = originalArgv.slice();
        (process as unknown as { exit: typeof process.exit }).exit = originalExit;
    });

    test("routes interactive service keys flow", async () => {
        mockCommonInteractiveDeps();
        mockCliDeps();
        mockSelect.mockResolvedValueOnce("serviceKeys");
        process.argv = ["node", "sship"];

        await import(`../src/index.ts?t=${Date.now()}-${Math.random()}`);

        expect(mockManageServiceKeys).toHaveBeenCalled();
        expect(parseMock).not.toHaveBeenCalled();
    });

    test("interactive mode handles ExitPromptError gracefully", async () => {
        class MockExitPromptError extends Error {}
        mock.module("@inquirer/core", () => ({ ExitPromptError: MockExitPromptError }));
        mockCommonInteractiveDeps();
        mockCliDeps();

        mockSelect.mockImplementationOnce(async () => {
            throw new MockExitPromptError("abort");
        });

        process.argv = ["node", "sship"];

        await import(`../src/index.ts?t=${Date.now()}-${Math.random()}`);

        expect(logger.info).toHaveBeenCalledWith("\n[SSHIP] Aborted. Exiting gracefully.");
        expect((process.exit as unknown as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(0);
    });

    test("routes CLI mode through commander parse and registers all commands", async () => {
        mockCommonInteractiveDeps();
        mockCliDeps();
        process.argv = ["node", "sship", "list"];

        await import(`../src/index.ts?t=${Date.now()}-${Math.random()}`);

        expect(parseMock).toHaveBeenCalledWith(["node", "sship", "list"]);
        expect(mockRegisterCreate).toHaveBeenCalled();
        expect(mockRegisterDelete).toHaveBeenCalled();
        expect(mockRegisterList).toHaveBeenCalled();
        expect(mockRegisterBackup).toHaveBeenCalled();
        expect(mockRegisterUninstall).toHaveBeenCalled();
        expect(mockRegisterDoctor).toHaveBeenCalled();
        expect(mockRegisterServers).toHaveBeenCalled();
        expect(mockRegisterTransfer).toHaveBeenCalled();
        expect(mockRegisterTunnel).toHaveBeenCalled();
        expect(mockRegisterRestore).toHaveBeenCalled();
    });
});
