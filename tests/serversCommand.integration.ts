import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const selectQueue: string[] = [];
const inputQueue: string[] = [];
const mockSelect = mock(async () => selectQueue.shift());
const mockInput = mock(async () => inputQueue.shift() ?? "");
const mockRunCommand = mock(async () => 0);

let serverRecords = [
    {
        name: "alpha",
        host: "10.0.0.1",
        port: 2222,
        user: "ubuntu",
        authMode: "identity_file",
        identityFile: "/mock/key.pem",
        createdAt: new Date().toISOString(),
    },
];

const mockLoadServers = mock(async () => serverRecords);
const mockGetServer = mock(async (name: string) => {
    const servers = await mockLoadServers();
    return servers.find((s) => s.name === name) || null;
});
const mockAddServer = mock(async () => {});
const mockDeleteServer = mock(async () => {});
const mockUpdateServer = mock(async () => {});
const mockCopyIdentityToSsh = mock(async (path: string) => path);
const mockAddToSshConfig = mock(async () => {});
const mockRemoveFromSshConfig = mock(async () => {});
const mockUpdateSshConfig = mock(async () => {});
const mockEnsureIdentityInAgent = mock(async () => "already_loaded");
const mockExistsSync = mock(() => true);
const mockReaddirSync = mock(() => ["prod.pem"]);

const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const commandPath = new URL("../src/utils/command.ts", import.meta.url).pathname;
const storagePath = new URL("../src/utils/serverStorage.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;
const sshConfigPath = new URL("../src/utils/sshConfig.ts", import.meta.url).pathname;
const sshAgentPath = new URL("../src/utils/sshAgent.ts", import.meta.url).pathname;

mock.module(selectPath, () => ({ select: mockSelect }));
mock.module("@inquirer/prompts", () => ({ input: mockInput }));
mock.module(commandPath, () => ({ runCommand: mockRunCommand }));
mock.module(storagePath, () => ({
    loadServers: mockLoadServers,
    getServer: mockGetServer,
    addServer: mockAddServer,
    updateServer: mockUpdateServer,
    deleteServer: mockDeleteServer,
    copyIdentityToSsh: mockCopyIdentityToSsh,
}));
mock.module(sshConfigPath, () => ({
    addToSshConfig: mockAddToSshConfig,
    removeFromSshConfig: mockRemoveFromSshConfig,
    updateSshConfig: mockUpdateSshConfig,
}));
mock.module(sshAgentPath, () => ({ ensureIdentityInAgent: mockEnsureIdentityInAgent }));
mock.module("fs", () => ({
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
}));
mock.module("os", () => ({
    homedir: () => "/mock/home",
}));
mock.module(loggerPath, () => ({
    logger: {
        info: () => {},
        fail: () => {},
        start: () => {},
        succeed: () => {},
        warn: () => {},
    },
}));

import { serversCommand } from "../src/commands/servers.ts";

describe("serversCommand", () => {
    beforeEach(() => {
        selectQueue.length = 0;
        inputQueue.length = 0;
        serverRecords = [
            {
                name: "alpha",
                host: "10.0.0.1",
                port: 2222,
                user: "ubuntu",
                authMode: "identity_file",
                identityFile: "/mock/key.pem",
                createdAt: new Date().toISOString(),
            },
        ];
        mockRunCommand.mockClear();
        mockAddServer.mockClear();
        mockDeleteServer.mockClear();
        mockAddToSshConfig.mockClear();
        mockRemoveFromSshConfig.mockClear();
        mockEnsureIdentityInAgent.mockClear();
    });

    test("connects to selected server from manage flow", async () => {
        selectQueue.push("manage", "alpha", "connect");
        await serversCommand();
        expect(mockRunCommand).toHaveBeenCalledWith("ssh", [
            "-p",
            "2222",
            "-o",
            "ConnectTimeout=10",
            "-i",
            "/mock/key.pem",
            "-o",
            "IdentitiesOnly=yes",
            "ubuntu@10.0.0.1",
        ]);
        expect(mockEnsureIdentityInAgent).toHaveBeenCalledWith("/mock/key.pem", { interactive: true });
    });

    test("adds server using ssh agent auth", async () => {
        selectQueue.push("add", "ssh_agent");
        inputQueue.push("prod-api", "192.168.1.50", "22", "ec2-user");

        await serversCommand();

        expect(mockAddServer).toHaveBeenCalled();
        const added = (mockAddServer.mock.calls[0] as unknown as [Record<string, string | number>])[0];
        expect(added.name).toBe("prod-api");
        expect(added.host).toBe("192.168.1.50");
        expect(added.port).toBe(22);
        expect(added.user).toBe("ec2-user");
        expect(added.authMode).toBe("ssh_agent");
        expect(added.identityFile).toBeUndefined();
        expect(mockAddToSshConfig).toHaveBeenCalled();
    });

    test("adds server using password auth", async () => {
        selectQueue.push("add", "password");
        inputQueue.push("lan-pass", "192.168.100.189", "22", "maks");

        await serversCommand();

        expect(mockAddServer).toHaveBeenCalled();
        const added = (mockAddServer.mock.calls[0] as unknown as [Record<string, string | number>])[0];
        expect(added.name).toBe("lan-pass");
        expect(added.authMode).toBe("password");
        expect(added.identityFile).toBeUndefined();
    });

    test("deletes server from manage flow", async () => {
        selectQueue.push("manage", "alpha", "delete", "Yes");

        await serversCommand();

        expect(mockDeleteServer).toHaveBeenCalledWith("alpha");
        expect(mockRemoveFromSshConfig).toHaveBeenCalledWith("alpha");
    });
});

afterAll(() => {
    mock.restore();
});
