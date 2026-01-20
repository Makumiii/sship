import { execSync } from "child_process";
import { platform } from "os";

/**
 * Attempts to copy text to the system clipboard.
 * Returns true if successful, false if no clipboard tool is available.
 */
export function copyToClipboard(text: string): boolean {
    const os = platform();

    try {
        if (os === "darwin") {
            // macOS
            execSync("pbcopy", { input: text });
            return true;
        } else if (os === "linux") {
            // Try different Linux clipboard tools
            const tools = [
                "xclip -selection clipboard",
                "xsel --clipboard --input",
                "wl-copy", // Wayland
            ];

            for (const tool of tools) {
                try {
                    execSync(tool, { input: text, stdio: ["pipe", "pipe", "pipe"] });
                    return true;
                } catch {
                    // Try next tool
                    continue;
                }
            }
            return false;
        }
        return false;
    } catch {
        return false;
    }
}
