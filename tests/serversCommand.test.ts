import { describe, expect, mock, test } from "bun:test";

const selectQueue: string[] = [];
const mockSelect = mock(async () => selectQueue.shift());
const mockRunCommand = mock(async () => {});
const mockLoadServers = mock(async () => [
    {
        name: "alpha",
        host: "10.0.0.1",
        port: 2222,
        user: "ubuntu",
        pemKeyPath: "/mock/key.pem",
        createdAt: new Date().toISOString(),
    },
]);
const mockGetServer = mock(async (name: string) => {
    const servers = await mockLoadServers();
    return servers.find((s) => s.name === name) || null;
});

const selectPath = new URL("../src/utils/select.ts", import.meta.url).pathname;
const commandPath = new URL("../src/utils/command.ts", import.meta.url).pathname;
const storagePath = new URL("../src/utils/serverStorage.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(selectPath, () => ({ select: mockSelect }));
mock.module(commandPath, () => ({ runCommand: mockRunCommand }));
mock.module(storagePath, () => ({
    loadServers: mockLoadServers,
    getServer: mockGetServer,
    addServer: mock(async () => {}),
    updateServer: mock(async () => {}),
    deleteServer: mock(async () => {}),
    copyPemToSsh: mock(async (path: string) => path),
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
    test("connects to selected server from manage flow", async () => {
        selectQueue.push("manage", "alpha", "connect");
        await serversCommand();
        expect(mockRunCommand).toHaveBeenCalledWith("ssh", [
            "-i",
            "/mock/key.pem",
            "-p",
            "2222",
            "-o",
            "IdentitiesOnly=yes",
            "ubuntu@10.0.0.1",
        ]);
    });
});
