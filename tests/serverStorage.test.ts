import { describe, expect, test, mock, beforeEach } from "bun:test";
import { addServer, deleteServer, loadServers, updateServer } from "../src/utils/serverStorage";
import type { ServerConfig } from "../src/types/serverTypes";

// Mock fs/promises and fs
const mockReadFile = mock(async () => JSON.stringify({ servers: [] }));
const mockWriteFile = mock(async () => { });
const mockMkdir = mock(async () => { });
const mockExistsSync = mock(() => true);

mock.module("fs/promises", () => ({
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
}));

mock.module("fs", () => ({
    existsSync: mockExistsSync,
}));

mock.module("os", () => ({
    homedir: () => "/mock/home",
}));

describe("Server Storage", () => {
    const testServer: ServerConfig = {
        name: "test-db",
        host: "10.0.0.1",
        port: 22,
        user: "admin",
        pemKeyPath: "/key.pem",
        createdAt: new Date().toISOString()
    };

    beforeEach(() => {
        mockReadFile.mockClear();
        mockWriteFile.mockClear();
        mockExistsSync.mockClear();
        mockReadFile.mockResolvedValue(JSON.stringify({ servers: [] }));
    });

    test("addServer saves new server", async () => {
        await addServer(testServer);
        expect(mockWriteFile).toHaveBeenCalled();
        const args = mockWriteFile.mock.calls[0] as unknown as [string, string];
        expect(args[1]).toContain("test-db");
        expect(args[1]).toContain("10.0.0.1");
    });

    test("addServer throws error if server exists", async () => {
        mockReadFile.mockResolvedValue(JSON.stringify({ servers: [testServer] }));
        expect(addServer(testServer)).rejects.toThrow('Server with name "test-db" already exists');
    });

    test("loadServers returns empty list if file corrupt", async () => {
        mockReadFile.mockResolvedValue("invalid json");
        const servers = await loadServers();
        expect(servers).toEqual([]);
    });

    test("deleteServer removes server", async () => {
        mockReadFile.mockResolvedValue(JSON.stringify({
            servers: [
                testServer,
                { ...testServer, name: "other" }
            ]
        }));

        await deleteServer("test-db");

        expect(mockWriteFile).toHaveBeenCalled();
        const writtenData = JSON.parse((mockWriteFile.mock.calls[0] as unknown as [string, string])[1]);
        expect(writtenData.servers).toHaveLength(1);
        expect(writtenData.servers[0].name).toBe("other");
    });

    test("updateServer modifies existing server", async () => {
        mockReadFile.mockResolvedValue(JSON.stringify({ servers: [testServer] }));
        const updated = { ...testServer, host: "10.0.0.99" };

        await updateServer("test-db", updated);

        const writtenData = JSON.parse((mockWriteFile.mock.calls[0] as unknown as [string, string])[1]);
        expect(writtenData.servers[0].host).toBe("10.0.0.99");
    });
});
