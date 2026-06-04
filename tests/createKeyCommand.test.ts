import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";

const mockPromptUser = mock(async (messages: Array<{ id: string; initialValue?: string }>) => {
    return {
        email: messages.find((m) => m.id === "email")?.initialValue ?? "me@example.com",
        passphrase: messages.find((m) => m.id === "passphrase")?.initialValue ?? "",
        name: messages.find((m) => m.id === "name")?.initialValue ?? "github-key",
        host: messages.find((m) => m.id === "host")?.initialValue ?? "github.com",
        user: messages.find((m) => m.id === "user")?.initialValue ?? "git",
    };
});
const mockSelect = mock(async () => "github");

const mockAddServiceKey = mock(async () => {});
const mockEnsureIdentityInAgent = mock(async () => "added");
const mockEnsureManagedAgent = mock(async () => ({ startedAgent: false, status: { running: true, socketPath: "/tmp/agent.sock", identities: "" } }));
const mockInstallManagedAgentAutostart = mock(async () => ({ shellHook: true, service: true }));
const mockIsManagedAgentShellHookInstalled = mock(async () => true);
const mockRepairServiceKeySshConfig = mock(async () => ({ repaired: false }));
const mockResolveScriptPath = mock(() => "/mock/scripts/commands/createKey.sh");
const mockLogger = {
    info: mock(() => {}),
    fail: mock(() => {}),
    start: mock(() => {}),
    succeed: mock(() => {}),
    warn: mock(() => {}),
};

let spawnExitCode = 0;
const mockSpawn = mock(() => {
    const child = new EventEmitter() as unknown as {
        on: (event: string, cb: (...args: unknown[]) => void) => void;
        emit: (event: string, ...args: unknown[]) => void;
    };

    setTimeout(() => {
        child.emit("close", spawnExitCode);
    }, 0);

    return child;
});

const promptPath = new URL("../src/utils/prompt.ts", import.meta.url).pathname;
const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const serviceKeysPath = new URL("../src/utils/serviceKeys.ts", import.meta.url).pathname;
const sshAgentPath = new URL("../src/utils/sshAgent.ts", import.meta.url).pathname;
const agentManagerPath = new URL("../src/utils/agentManager.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;
const sshConfigPath = new URL("../src/utils/sshConfig.ts", import.meta.url).pathname;
const scriptPath = new URL("../src/utils/scriptPath.ts", import.meta.url).pathname;

mock.module(promptPath, () => ({ promptUser: mockPromptUser }));
mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(serviceKeysPath, () => ({ addServiceKey: mockAddServiceKey }));
mock.module(sshAgentPath, () => ({ ensureIdentityInAgent: mockEnsureIdentityInAgent }));
mock.module(agentManagerPath, () => ({
    ensureManagedAgent: mockEnsureManagedAgent,
    installManagedAgentAutostart: mockInstallManagedAgentAutostart,
    isManagedAgentShellHookInstalled: mockIsManagedAgentShellHookInstalled,
}));
mock.module(sshConfigPath, () => ({ repairServiceKeySshConfig: mockRepairServiceKeySshConfig }));
mock.module(scriptPath, () => ({ resolveScriptPath: mockResolveScriptPath }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module("child_process", () => ({ spawn: mockSpawn }));

import createKeyCommand from "../src/commands/createKey.ts";

describe("create key command", () => {
    const originalTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

    beforeEach(() => {
        spawnExitCode = 0;
        Object.defineProperty(process.stdin, "isTTY", {
            configurable: true,
            value: true,
        });
        mockPromptUser.mockClear();
        mockSelect.mockClear();
        mockAddServiceKey.mockClear();
        mockEnsureIdentityInAgent.mockClear();
        mockEnsureManagedAgent.mockClear();
        mockInstallManagedAgentAutostart.mockClear();
        mockInstallManagedAgentAutostart.mockResolvedValue({ shellHook: true, service: true });
        mockIsManagedAgentShellHookInstalled.mockClear();
        mockIsManagedAgentShellHookInstalled.mockResolvedValue(true);
        mockRepairServiceKeySshConfig.mockClear();
        mockRepairServiceKeySshConfig.mockResolvedValue({ repaired: false });
        mockResolveScriptPath.mockClear();
        mockSpawn.mockClear();
        mockLogger.start.mockClear();
        mockLogger.succeed.mockClear();
        mockLogger.fail.mockClear();
        mockLogger.info.mockClear();
    });

    afterEach(() => {
        if (originalTtyDescriptor) {
            Object.defineProperty(process.stdin, "isTTY", originalTtyDescriptor);
        }
    });

    test("uses CLI options as prompt initial values and stores key on success", async () => {
        await createKeyCommand({
            email: "dev@example.com",
            passphrase: "secret",
            name: "gh-prod",
            host: "github.com",
            user: "git",
        });

        const messages = (mockPromptUser.mock.calls[0] as unknown as [Array<{ id: string; initialValue?: string }>])[0];
        expect(messages.find((m) => m.id === "email")?.initialValue).toBe("dev@example.com");
        expect(messages.find((m) => m.id === "name")?.initialValue).toBe("gh-prod");

        expect(mockSpawn).toHaveBeenCalled();
        expect(mockLogger.start).toHaveBeenCalledWith("Generating SSH key...");
        expect(mockLogger.succeed).toHaveBeenCalledWith("SSH key creation complete.");
        expect(mockAddServiceKey).toHaveBeenCalledWith("gh-prod");
        expect(mockRepairServiceKeySshConfig).toHaveBeenCalledWith(["gh-prod"]);
        expect(mockEnsureManagedAgent).toHaveBeenCalled();
        expect(mockEnsureIdentityInAgent).toHaveBeenCalled();
    });

    test("prompts to install managed agent hook when key is loaded but shell hook is missing", async () => {
        mockIsManagedAgentShellHookInstalled.mockResolvedValueOnce(false);
        mockSelect.mockResolvedValueOnce("Yes");

        await createKeyCommand({
            email: "dev@example.com",
            passphrase: "secret",
            name: "gh-prod",
            host: "github.com",
            user: "git",
        });

        expect(mockSelect).toHaveBeenCalledWith(
            "Install managed ssh-agent shell hook so future git pushes can reuse this key?",
            ["Yes", "No"],
        );
        expect(mockInstallManagedAgentAutostart).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith("Installed shell hook for future terminals.");
    });

    test("prints a concrete next step when managed agent hook install is declined", async () => {
        mockIsManagedAgentShellHookInstalled.mockResolvedValueOnce(false);
        mockSelect.mockResolvedValueOnce("No");

        await createKeyCommand({
            email: "dev@example.com",
            passphrase: "secret",
            name: "gh-prod",
            host: "github.com",
            user: "git",
        });

        expect(mockInstallManagedAgentAutostart).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
            "Run `sship init --fix` and open a new terminal to let git reuse this key without repeated passphrase prompts."
        );
    });

    test("does not add service key when script fails", async () => {
        spawnExitCode = 1;

        await createKeyCommand({ name: "failed-key" });

        expect(mockLogger.fail).toHaveBeenCalledWith("SSH key creation failed.");
        expect(mockAddServiceKey).not.toHaveBeenCalled();
    });

    test("applies template defaults for host and user", async () => {
        await createKeyCommand({
            email: "dev@example.com",
            passphrase: "secret",
            name: "gitlab-prod",
            template: "gitlab",
        });

        const messages = (mockPromptUser.mock.calls[0] as unknown as [Array<{ id: string; initialValue?: string }>])[0];
        expect(messages.find((m) => m.id === "host")?.initialValue).toBe("gitlab.com");
        expect(messages.find((m) => m.id === "user")?.initialValue).toBe("git");
        expect(mockLogger.info).toHaveBeenCalledWith(
            "Add your public key in GitLab: https://gitlab.com/-/user_settings/ssh_keys"
        );
    });

    test("fails fast for unknown template", async () => {
        await createKeyCommand({
            name: "bad-template",
            template: "does-not-exist",
        });

        expect(mockSpawn).not.toHaveBeenCalled();
        expect(mockLogger.fail).toHaveBeenCalledWith(
            'Unknown template "does-not-exist". Use --list-templates to see available templates.'
        );
    });

    test("lists templates and exits when requested", async () => {
        const logSpy = mock(() => {});
        const originalLog = console.log;
        console.log = logSpy;

        try {
            await createKeyCommand({ listTemplates: true });
        } finally {
            console.log = originalLog;
        }

        expect(mockSpawn).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalled();
    });
});
