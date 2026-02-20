import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerConfig } from "../src/types/serverTypes.ts";

type SshConfigModule = typeof import("../src/utils/sshConfig.ts");

let testHome = "";

async function loadSshConfigModule(): Promise<SshConfigModule> {
    mock.module("node:os", () => ({ homedir: () => testHome }));
    return import(`../src/utils/sshConfig.ts?t=${Date.now()}-${Math.random()}`);
}

describe("SSH Config Management", () => {
    const testServer: ServerConfig = {
        name: "test-server",
        host: "192.168.1.1",
        port: 22,
        user: "root",
        pemKeyPath: "/tmp/mock-home/.ssh/test-server.pem",
        createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
        mock.restore();
        testHome = mkdtempSync(join(tmpdir(), "sship-ssh-config-"));
        mkdirSync(join(testHome, ".ssh"), { recursive: true });
    });

    afterEach(() => {
        if (testHome && existsSync(testHome)) {
            rmSync(testHome, { recursive: true, force: true });
        }
    });

    test("generateSshConfigBlock creates correct config string", async () => {
        const { generateSshConfigBlock } = await loadSshConfigModule();
        const block = generateSshConfigBlock(testServer);

        expect(block).toContain("Host test-server");
        expect(block).toContain("HostName 192.168.1.1");
        expect(block).toContain("User root");
        expect(block).toContain("IdentityFile /tmp/mock-home/.ssh/test-server.pem");
        expect(block).toContain("IdentitiesOnly yes");
    });

    test("addToSshConfig appends new block", async () => {
        const { addToSshConfig } = await loadSshConfigModule();
        const sshConfigPath = join(testHome, ".ssh", "config");
        writeFileSync(sshConfigPath, "Existing content\n", "utf-8");

        await addToSshConfig(testServer);

        const content = readFileSync(sshConfigPath, "utf-8");
        expect(content).toContain("Existing content");
        expect(content).toContain("Host test-server");
    });

    test("addToSshConfig removes existing entry before adding", async () => {
        const { addToSshConfig } = await loadSshConfigModule();
        const sshConfigPath = join(testHome, ".ssh", "config");

        writeFileSync(
            sshConfigPath,
            `# Added by sship - test-server
Host test-server
    HostName old.host
    User old
`,
            "utf-8"
        );

        await addToSshConfig(testServer);

        const content = readFileSync(sshConfigPath, "utf-8");
        expect(content).toContain("HostName 192.168.1.1");
        expect(content).not.toContain("HostName old.host");
    });

    test("removeFromSshConfig removes specific block", async () => {
        const { removeFromSshConfig } = await loadSshConfigModule();
        const sshConfigPath = join(testHome, ".ssh", "config");

        writeFileSync(
            sshConfigPath,
            `Some other host

# Added by sship - test-server
Host test-server
    HostName 192.168.1.1

Host another-host
    HostName 10.0.0.2
`,
            "utf-8"
        );

        await removeFromSshConfig("test-server");

        const content = readFileSync(sshConfigPath, "utf-8");
        expect(content).not.toContain("Host test-server");
        expect(content).toContain("Some other host");
        expect(content).toContain("Host another-host");
    });

    test("addToSshConfig replaces existing plain host block without sship marker", async () => {
        const { addToSshConfig } = await loadSshConfigModule();
        const sshConfigPath = join(testHome, ".ssh", "config");

        writeFileSync(
            sshConfigPath,
            `Host test-server
    HostName old.example.com
    User olduser
    IdentityFile /tmp/old
`,
            "utf-8"
        );

        await addToSshConfig(testServer);

        const content = readFileSync(sshConfigPath, "utf-8");
        const hostMatches = content.match(/Host test-server/g) ?? [];
        expect(hostMatches.length).toBe(1);
        expect(content).toContain("HostName 192.168.1.1");
        expect(content).not.toContain("HostName old.example.com");
    });
});
