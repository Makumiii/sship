import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";

const mockPromptUser = mock(async () => ({ passphrase: "secret-pass" }));
const mockCopyFile = mock(async () => {});
const mockMkdtemp = mock(async () => "/tmp/restore-extract-abc");
const mockMkdir = mock(async () => {});
const mockReaddir = mock(async () => ["id_ed25519", "id_ed25519.pub", "config"]);
const mockRm = mock(async () => {});
const mockChmod = mock(async () => {});
const mockStat = mock(async () => ({ isFile: () => true }));
const existingPaths = new Set<string>();
const mockExistsSync = mock((path: string) => path.endsWith("sship_backup.tar.gz") || existingPaths.has(path));

const mockLogger = {
  info: mock(() => {}),
  fail: mock(() => {}),
  start: mock(() => {}),
  succeed: mock(() => {}),
  warn: mock(() => {}),
};

const spawnPlan: Array<{ code: number; stdout?: string; stderr?: string }> = [];
const mockSpawn = mock((_cmd: string, _args: string[]) => {
  const child = new EventEmitter() as unknown as {
    stdout: EventEmitter;
    stderr: EventEmitter;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
  (child as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
  (child as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();

  const next = spawnPlan.shift() ?? { code: 0, stdout: "", stderr: "" };
  setTimeout(() => {
    if (next.stdout) child.stdout.emit("data", next.stdout);
    if (next.stderr) child.stderr.emit("data", next.stderr);
    child.emit("close", next.code);
  }, 0);

  return child;
});

const promptPath = new URL("../src/utils/prompt.ts", import.meta.url).pathname;
const loggerPath = new URL("../src/utils/logger.ts", import.meta.url).pathname;

mock.module(promptPath, () => ({ promptUser: mockPromptUser }));
mock.module(loggerPath, () => ({ logger: mockLogger }));
mock.module("node:child_process", () => ({ spawn: mockSpawn }));
mock.module("node:os", () => ({ homedir: () => "/mock/home", tmpdir: () => "/tmp" }));
mock.module("node:fs", () => ({ existsSync: mockExistsSync }));
mock.module("node:fs/promises", () => ({
  copyFile: mockCopyFile,
  mkdtemp: mockMkdtemp,
  mkdir: mockMkdir,
  readdir: mockReaddir,
  rm: mockRm,
  chmod: mockChmod,
  stat: mockStat,
}));

import restoreCommand from "../src/commands/restore.ts";

describe("restore command", () => {
  beforeEach(() => {
    spawnPlan.length = 0;
    mockPromptUser.mockClear();
    mockCopyFile.mockClear();
    mockMkdtemp.mockClear();
    mockMkdir.mockClear();
    mockReaddir.mockClear();
    mockRm.mockClear();
    mockChmod.mockClear();
    mockStat.mockClear();
    mockExistsSync.mockClear();
    existingPaths.clear();
    mockLogger.info.mockClear();
    mockLogger.fail.mockClear();
    mockLogger.start.mockClear();
    mockLogger.succeed.mockClear();
    mockLogger.warn.mockClear();
    mockSpawn.mockClear();
  });

  test("dry-run validates archive and does not restore files", async () => {
    spawnPlan.push({ code: 0, stdout: "./id_ed25519\n./id_ed25519.pub\n" });

    await restoreCommand({ dryRun: true });

    expect(mockLogger.succeed).toHaveBeenCalledWith("Dry run complete. Would restore 2 file(s); skip 0.");
    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  test("restores files from archive", async () => {
    spawnPlan.push({ code: 0, stdout: "./id_ed25519\n./id_ed25519.pub\n" }); // tar list
    spawnPlan.push({ code: 0, stdout: "" }); // tar extract

    await restoreCommand();

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockCopyFile).toHaveBeenCalled();
    expect(mockLogger.succeed).toHaveBeenCalledWith("Restore completed. Restored 2 file(s), skipped 0.");
  });

  test("dry-run with only filter warns for missing requested files", async () => {
    spawnPlan.push({ code: 0, stdout: "./id_ed25519\n./id_ed25519.pub\n./config\n" });

    await restoreCommand({ dryRun: true, only: "id_ed25519,missing-file" });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Requested files not present in archive: missing-file"
    );
    expect(mockLogger.succeed).toHaveBeenCalledWith(
      "Dry run complete. Would restore 1 file(s); skip 0."
    );
  });

  test("restore with only filter copies selected files only", async () => {
    spawnPlan.push({ code: 0, stdout: "./id_ed25519\n./id_ed25519.pub\n./config\n" }); // list
    spawnPlan.push({ code: 0, stdout: "" }); // extract

    await restoreCommand({ only: "config" });

    const copyCalls = mockCopyFile.mock.calls as unknown as Array<[string, string]>;
    expect(copyCalls.length).toBe(1);
    expect(copyCalls[0]?.[1].endsWith("/.ssh/config")).toBe(true);
  });

  test("fails when archive is missing", async () => {
    mockExistsSync.mockReturnValue(false);

    await restoreCommand({ archive: "/missing/backup.tar.gz" });

    expect(mockLogger.fail).toHaveBeenCalledWith("Backup archive not found: /missing/backup.tar.gz");
  });
});
