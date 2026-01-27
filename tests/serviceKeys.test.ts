import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockReadFile = mock(async () => JSON.stringify({ keys: ["alpha"] }));
const mockWriteFile = mock(async () => {});
const mockMkdir = mock(async () => {});

mock.module("fs/promises", () => ({
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
}));

mock.module("os", () => ({
    homedir: () => "/mock/home",
}));

import {
    addServiceKey,
    loadServiceKeys,
    removeServiceKey,
} from "../src/utils/serviceKeys.ts";

describe("service keys store", () => {
    beforeEach(() => {
        mockReadFile.mockClear();
        mockWriteFile.mockClear();
        mockMkdir.mockClear();
        mockReadFile.mockResolvedValue(JSON.stringify({ keys: ["alpha"] }));
    });

    test("loadServiceKeys returns empty when file missing", async () => {
        mockReadFile.mockRejectedValueOnce(new Error("missing"));
        const keys = await loadServiceKeys();
        expect(keys).toEqual([]);
    });

    test("addServiceKey writes new key", async () => {
        await addServiceKey("beta");
        expect(mockWriteFile).toHaveBeenCalled();
        const payload = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1];
        expect(payload).toContain("\"alpha\"");
        expect(payload).toContain("\"beta\"");
    });

    test("removeServiceKey removes key", async () => {
        await removeServiceKey("alpha");
        expect(mockWriteFile).toHaveBeenCalled();
        const payload = (mockWriteFile.mock.calls[0] as unknown as [string, string])[1];
        expect(payload).not.toContain("\"alpha\"");
    });
});
