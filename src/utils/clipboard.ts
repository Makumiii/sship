import { execFileSync } from "child_process";
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
            execFileSync("pbcopy", [], {
                input: text,
                stdio: ["pipe", "ignore", "ignore"],
                timeout: 2000,
            });
            return true;
        } else if (os === "linux") {
            // Try different Linux clipboard tools
            const tools = [
                { command: "xclip", args: ["-selection", "clipboard"] },
                { command: "xsel", args: ["--clipboard", "--input"] },
                { command: "wl-copy", args: [] }, // Wayland
            ];

            for (const tool of tools) {
                try {
                    execFileSync(tool.command, tool.args, {
                        input: text,
                        // Clipboard tools can keep running as the clipboard owner.
                        // Do not let inherited output pipes keep this process alive.
                        stdio: ["pipe", "ignore", "ignore"],
                        timeout: 2000,
                    });
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
