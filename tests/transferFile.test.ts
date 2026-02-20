import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockReadFile = mock(async () => Buffer.from("pem"));
const mockStat = mock(async (path: string) => {
    if (path.endsWith("/dir") || path.endsWith("/subdir")) {
        return { isDirectory: () => true, isFile: () => false };
    }
    if (path.endsWith("/file1") || path.endsWith("/file2")) {
        return { isDirectory: () => false, isFile: () => true };
    }
    return { isDirectory: () => false, isFile: () => false };
});
const mockReaddir = mock(async (path: string) => {
    if (path.endsWith("/dir")) {
        return [
            { name: "file1", isDirectory: () => false, isFile: () => true },
            { name: "subdir", isDirectory: () => true, isFile: () => false },
            { name: "link", isDirectory: () => false, isFile: () => false },
        ];
    }
    if (path.endsWith("/subdir")) {
        return [
            { name: "file2", isDirectory: () => false, isFile: () => true },
        ];
    }
    return [];
});
const mockMkdir = mock(async () => {});

mock.module("fs/promises", () => ({
    readFile: mockReadFile,
    stat: mockStat,
    readdir: mockReaddir,
    mkdir: mockMkdir,
}));

const mockConnect = mock(async () => {});
const mockEnd = mock(async () => {});
const mockMkdirRemote = mock(async (_path: string) => {});
const mockFastPut = mock(async (_localPath: string, _remotePath: string) => {});
const mockFastGet = mock(async (_remotePath: string, _localPath: string) => {});
const mockList = mock(async (path: string) => {
    if (path.endsWith("/dir")) {
        return [
            { name: "subdir", type: "d" },
            { name: "file1", type: "-" },
            { name: "link", type: "l" },
        ];
    }
    if (path.endsWith("/dir/subdir")) {
        return [{ name: "file2", type: "-" }];
    }
    return [];
});
const mockStatRemote = mock(async (_path: string) => ({ isDirectory: true }));

class MockClient {
    connect() { return mockConnect(); }
    end() { return mockEnd(); }
    mkdir(path: string) { return mockMkdirRemote(path); }
    fastPut(localPath: string, remotePath: string) { return mockFastPut(localPath, remotePath); }
    fastGet(remotePath: string, localPath: string) { return mockFastGet(remotePath, localPath); }
    list(path: string) { return mockList(path); }
    stat(path: string) { return mockStatRemote(path); }
}

mock.module("ssh2-sftp-client", () => ({
    default: MockClient,
}));

import type { IncomingMessage } from "http";
import { transferFile } from "../src/transfer/server.ts";

const mockReq = {
    on() {},
    off() {},
} as unknown as IncomingMessage;

const server = {
    name: "alpha",
    host: "127.0.0.1",
    port: 22,
    user: "root",
    authMode: "identity_file" as const,
    identityFile: "/mock/key.pem",
    createdAt: new Date().toISOString(),
};

describe("transferFile", () => {
    beforeEach(() => {
        mockReadFile.mockClear();
        mockStat.mockClear();
        mockReaddir.mockClear();
        mockMkdir.mockClear();
        mockConnect.mockClear();
        mockEnd.mockClear();
        mockMkdirRemote.mockClear();
        mockFastPut.mockClear();
        mockFastGet.mockClear();
        mockList.mockClear();
        mockStatRemote.mockClear();
    });

    test("uploads directories recursively and skips non-regular files", async () => {
        await transferFile(mockReq, server, "/local/dir", "/remote", "upload");
        expect(mockMkdirRemote).toHaveBeenCalled();
        const uploadCalls = mockFastPut.mock.calls as unknown as Array<[string, string]>;
        expect(uploadCalls.some(([local, remote]) =>
            local === "/local/dir/file1" && remote === "/remote/dir/file1"
        )).toBe(true);
        expect(uploadCalls.some(([local, remote]) =>
            local === "/local/dir/subdir/file2" && remote === "/remote/dir/subdir/file2"
        )).toBe(true);
        expect(mockFastPut).toHaveBeenCalledTimes(2);
    });

    test("downloads directories recursively", async () => {
        mockStatRemote.mockResolvedValueOnce({ isDirectory: true });
        await transferFile(mockReq, server, "/local", "/remote/dir", "download");
        const downloadCalls = mockFastGet.mock.calls as unknown as Array<[string, string]>;
        expect(downloadCalls.some(([remote, local]) =>
            remote === "/remote/dir/file1" && local === "/local/dir/file1"
        )).toBe(true);
        expect(downloadCalls.some(([remote, local]) =>
            remote === "/remote/dir/subdir/file2" && local === "/local/dir/subdir/file2"
        )).toBe(true);
    });
});
