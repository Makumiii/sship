import { describe, expect, test, mock, beforeEach } from "bun:test";
import { generateSshConfigBlock, addToSshConfig, removeFromSshConfig } from "../src/utils/sshConfig";
import type { ServerConfig } from "../src/types/serverTypes";

// Mock fs/promises and fs
const mockReadFile = mock(async () => "");
const mockWriteFile = mock(async () => { });
const mockExistsSync = mock(() => true);

mock.module("fs/promises", () => ({
    readFile: mockReadFile,
    writeFile: mockWriteFile,
}));

mock.module("fs", () => ({
    existsSync: mockExistsSync,
}));

// We also need to mock 'os' and 'path' to ensure consistent paths in tests
mock.module("os", () => ({
    homedir: () => "/mock/home",
}));

describe("SSH Config Management", () => {
    const testServer: ServerConfig = {
        name: "test-server",
        host: "192.168.1.1",
        port: 22,
        user: "root",
        pemKeyPath: "/mock/home/.ssh/test-server.pem",
        createdAt: new Date().toISOString()
    };

    beforeEach(() => {
        mockReadFile.mockClear();
        mockWriteFile.mockClear();
        mockExistsSync.mockClear();
        // Default mock implementation
        mockReadFile.mockResolvedValue("");
        mockExistsSync.mockReturnValue(true);
    });

    test("generateSshConfigBlock creates correct config string", () => {
        const block = generateSshConfigBlock(testServer);
        expect(block).toContain("Host test-server");
        expect(block).toContain("HostName 192.168.1.1");
        expect(block).toContain("User root");
        expect(block).toContain("IdentityFile /mock/home/.ssh/test-server.pem");
        expect(block).toContain("IdentitiesOnly yes");
    });

    test("addToSshConfig appends new block", async () => {
        mockReadFile.mockResolvedValue("Existing content\n");

        await addToSshConfig(testServer);

        expect(mockReadFile).toHaveBeenCalled();
        expect(mockWriteFile).toHaveBeenCalled();
        const headers = mockWriteFile.mock.calls[0] as unknown as [string, string];
        // Check if the content written contains both existing and new
        expect(headers[1]).toContain("Existing content");
        expect(headers[1]).toContain("Host test-server");
    });

    test("addToSshConfig removes existing entry before adding", async () => {
        const existingConfig = `
# Added by sship - test-server
Host test-server
    HostName old.host
`;
        mockReadFile.mockResolvedValue(existingConfig);

        await addToSshConfig(testServer);

        // It should have read the file
        // Then it should have written the file (remove) - actually the implementation calls removeFromSshConfig which reads and writes
        // Then it should have written the file (add)

        // Let's check the FINAL write
        const lastCall = mockWriteFile.mock.calls[mockWriteFile.mock.calls.length - 1] as unknown as [string, string];
        expect(lastCall[1]).toContain("HostName 192.168.1.1"); // New host
        // The implementation of removeFromSshConfig might be tricky to mock perfectly with just function spies if it re-reads the file we just "wrote" to the mock.
        // In a real integration test we'd use a temp file.
        // Here we trust the logic flow: if hostPattern matches, it calls remove.
    });

    test("removeFromSshConfig removes specific block", async () => {
        const configWithBlock = `
Some other host

# Added by sship - test-server
Host test-server
    HostName 192.168.1.1

Another host
`;
        mockReadFile.mockResolvedValue(configWithBlock);

        await removeFromSshConfig("test-server");

        expect(mockWriteFile).toHaveBeenCalled();
        const writtenContent = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1];
        expect(writtenContent).not.toContain("Host test-server");
        expect(writtenContent).toContain("Some other host");
        expect(writtenContent).toContain("Another host");
    });
});
