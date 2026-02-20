import { beforeEach, describe, expect, mock, test } from "bun:test";
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
    };

    setTimeout(() => {
        child.emit("close", spawnExitCode);
    }, 0);

    return child;
});

const promptPath = new URL("../src/utils/prompt.ts", import.meta.url).pathname;
const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const serviceKeysPath = new URL("../src/utils/serviceKeys.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(promptPath, () => ({ promptUser: mockPromptUser }));
mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(serviceKeysPath, () => ({ addServiceKey: mockAddServiceKey }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module("child_process", () => ({ spawn: mockSpawn }));

import createKeyCommand from "../src/commands/createKey.ts";

describe("create key command", () => {
    beforeEach(() => {
        spawnExitCode = 0;
        mockPromptUser.mockClear();
        mockSelect.mockClear();
        mockAddServiceKey.mockClear();
        mockSpawn.mockClear();
        mockLogger.start.mockClear();
        mockLogger.succeed.mockClear();
        mockLogger.fail.mockClear();
        mockLogger.info.mockClear();
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
