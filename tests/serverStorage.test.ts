import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerConfig } from "../src/types/serverTypes.ts";

type ServerStorageModule = typeof import("../src/utils/serverStorage.ts");

let testHome = "";

async function loadServerStorageModule(): Promise<ServerStorageModule> {
  mock.module("os", () => ({ homedir: () => testHome }));
  return import(`../src/utils/serverStorage.ts?t=${Date.now()}-${Math.random()}`);
}

describe("Server Storage", () => {
  const testServer: ServerConfig = {
    name: "test-db",
    host: "10.0.0.1",
    port: 22,
    user: "admin",
    authMode: "identity_file",
    identityFile: "/tmp/key",
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mock.restore();
    testHome = mkdtempSync(join(tmpdir(), "sship-server-storage-"));
  });

  afterEach(() => {
    if (testHome && existsSync(testHome)) {
      rmSync(testHome, { recursive: true, force: true });
    }
  });

  test("addServer and loadServers roundtrip", async () => {
    const { addServer, loadServers } = await loadServerStorageModule();
    await addServer(testServer);

    const servers = await loadServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBe("test-db");
    expect(servers[0]?.authMode).toBe("identity_file");
  });

  test("addServer throws if name exists", async () => {
    const { addServer } = await loadServerStorageModule();
    await addServer(testServer);
    await expect(addServer(testServer)).rejects.toThrow('Server with name "test-db" already exists');
  });

  test("loadServers drops invalid legacy entries", async () => {
    const { loadServers } = await loadServerStorageModule();
    const serversFile = join(testHome, ".sship", "servers.json");
    mkdirSync(join(testHome, ".sship"), { recursive: true });
    // Ensure directory/file exists with mixed content.
    writeFileSync(
      serversFile,
      JSON.stringify(
        {
          servers: [
            testServer,
            {
              name: "legacy",
              host: "1.1.1.1",
              port: 22,
              user: "root",
              pemKeyPath: "/old/path",
              createdAt: new Date().toISOString(),
            },
          ],
        },
        null,
        2
      ),
      "utf-8"
    );

    const servers = await loadServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]?.name).toBe("test-db");
  });

  test("updateServer modifies existing server", async () => {
    const { addServer, updateServer, getServer } = await loadServerStorageModule();
    await addServer(testServer);

    const updated = { ...testServer, host: "10.0.0.99" };
    await updateServer("test-db", updated);

    const server = await getServer("test-db");
    expect(server?.host).toBe("10.0.0.99");
  });

  test("deleteServer removes existing server", async () => {
    const { addServer, deleteServer, loadServers } = await loadServerStorageModule();
    await addServer(testServer);

    await deleteServer("test-db");

    const servers = await loadServers();
    expect(servers).toHaveLength(0);
  });
});
