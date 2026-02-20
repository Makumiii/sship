import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function ensureBuilt(): boolean {
  return existsSync(join(process.cwd(), "dist/index.js"));
}

describe("logs command integration", () => {
  const tempHomes: string[] = [];

  afterEach(() => {
    while (tempHomes.length > 0) {
      const home = tempHomes.pop();
      if (home && existsSync(home)) {
        rmSync(home, { recursive: true, force: true });
      }
    }
  });

  test("logs command filters by level and line count", () => {
    if (!ensureBuilt()) return;

    const home = mkdtempSync(join(tmpdir(), "sship-logs-home-"));
    tempHomes.push(home);
    const logDir = join(home, ".sship", "logs");
    mkdirSync(logDir, { recursive: true });
    writeFileSync(
      join(logDir, "sship.log"),
      [
        "2026-01-01T00:00:00.000Z - INFO: one",
        "2026-01-01T00:00:01.000Z - FAIL: bad",
        "2026-01-01T00:00:02.000Z - INFO: two",
      ].join("\n"),
      "utf-8"
    );

    const result = spawnSync("node", ["dist/index.js", "logs", "--level", "INFO", "--lines", "1"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home },
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    expect(output).toContain("INFO: two");
    expect(output).not.toContain("INFO: one");
  });

  test("logs command reports when no logs exist", () => {
    if (!ensureBuilt()) return;

    const home = mkdtempSync(join(tmpdir(), "sship-logs-home-"));
    tempHomes.push(home);

    const result = spawnSync("node", ["dist/index.js", "logs"], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home },
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    expect(output).toContain("No logs found yet.");
  });
});
