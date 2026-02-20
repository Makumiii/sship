import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function ensureBuilt(): boolean {
  return existsSync(join(process.cwd(), "dist/index.js"));
}

describe("init command integration", () => {
  const tempHomes: string[] = [];

  afterEach(() => {
    while (tempHomes.length > 0) {
      const home = tempHomes.pop();
      if (home && existsSync(home)) {
        rmSync(home, { recursive: true, force: true });
      }
    }
  });

  test("init --fix creates ~/.ssh and ~/.sship", async () => {
    if (!ensureBuilt()) return;

    const home = mkdtempSync(join(tmpdir(), "sship-init-home-"));
    tempHomes.push(home);

    const result = spawnSync("node", ["dist/index.js", "init", "--fix"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home },
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(existsSync(join(home, ".ssh"))).toBe(true);
    expect(existsSync(join(home, ".sship"))).toBe(true);

    const sshDirStat = await stat(join(home, ".ssh"));
    expect(sshDirStat.isDirectory()).toBe(true);
  });
});
