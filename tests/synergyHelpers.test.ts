import { describe, expect, test } from "bun:test";

import "../src/transfer/public/helpers.js";

const helpers = (globalThis as unknown as { SynergyHelpers: any }).SynergyHelpers;

describe("synergy helpers", () => {
    test("joinRemotePath normalizes slashes", () => {
        expect(helpers.joinRemotePath("", "app")).toBe("/app");
        expect(helpers.joinRemotePath("/home/user", "app")).toBe("/home/user/app");
        expect(helpers.joinRemotePath("/home/user/", "app")).toBe("/home/user/app");
        expect(helpers.joinRemotePath("///home//user//", "app")).toBe("/home/user/app");
    });

    test("formatTransferStatus formats status", () => {
        expect(helpers.formatTransferStatus("upload", "/path/file.txt", 12)).toBe(
            "Uploading: file.txt (12%)"
        );
        expect(helpers.formatTransferStatus("download", "file.txt", 80)).toBe(
            "Downloading: file.txt (80%)"
        );
        expect(helpers.formatTransferStatus("upload", "", 5)).toBe("Uploading (5%)");
    });

    test("getConnectionState provides refresh text", () => {
        expect(helpers.getConnectionState(false)).toEqual({
            panelText: "Connecting to server...",
            statusText: "Connecting...",
        });
        expect(helpers.getConnectionState(true)).toEqual({
            panelText: "Refreshing connection...",
            statusText: "Refreshing...",
        });
    });
});
