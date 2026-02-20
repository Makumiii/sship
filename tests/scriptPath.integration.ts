import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveScriptPath } from "../src/utils/scriptPath.ts";

describe("resolveScriptPath", () => {
    beforeEach(() => {
        mock.restore();
    });

    test("resolves source layout path", () => {
        const root = mkdtempSync(join(tmpdir(), "sship-script-src-"));
        const baseDir = join(root, "src", "commands");
        const scriptPath = join(root, "scripts", "commands", "createKey.sh");

        mkdirSync(join(root, "src", "commands"), { recursive: true });
        mkdirSync(join(root, "scripts", "commands"), { recursive: true });
        writeFileSync(scriptPath, "#!/usr/bin/env sh\n", "utf-8");

        const resolved = resolveScriptPath(baseDir, "commands/createKey.sh");
        expect(resolved).toBe(scriptPath);

        rmSync(root, { recursive: true, force: true });
    });

    test("resolves bundled dist layout path", () => {
        const root = mkdtempSync(join(tmpdir(), "sship-script-dist-"));
        const baseDir = join(root, "dist");
        const scriptPath = join(root, "scripts", "commands", "backup.sh");

        mkdirSync(baseDir, { recursive: true });
        mkdirSync(join(root, "scripts", "commands"), { recursive: true });
        writeFileSync(scriptPath, "#!/usr/bin/env sh\n", "utf-8");

        const resolved = resolveScriptPath(baseDir, "commands/backup.sh");
        expect(resolved).toBe(scriptPath);

        rmSync(root, { recursive: true, force: true });
    });

    test("throws clear error when script is missing", () => {
        const root = mkdtempSync(join(tmpdir(), "sship-script-missing-"));
        const baseDir = join(root, "src", "commands");
        mkdirSync(baseDir, { recursive: true });

        expect(() => resolveScriptPath(baseDir, "commands/missing.sh")).toThrow(
            'Could not locate script "commands/missing.sh"'
        );

        if (existsSync(root)) {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
