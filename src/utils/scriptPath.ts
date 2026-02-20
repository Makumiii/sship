import { existsSync } from "node:fs";
import { join } from "node:path";

export function resolveScriptPath(baseDir: string, scriptRelativePath: string): string {
    const candidates = [
        join(baseDir, "../scripts", scriptRelativePath),   // bundled dist layout
        join(baseDir, "../../scripts", scriptRelativePath), // source layout
        join(process.cwd(), "scripts", scriptRelativePath), // cwd fallback
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        `Could not locate script "${scriptRelativePath}". Tried: ${candidates.join(", ")}`
    );
}
