import { spawn } from "child_process";
import { startTransferServerWithFallback, getTransferPort } from "../transfer/server.ts";
import { logger } from "../utils/logger.ts";
import { platform } from "os";

export async function transferCommand(): Promise<void> {
    try {
        // Start the server
        await startTransferServerWithFallback();

        const url = `http://localhost:${getTransferPort()}`;

        // Attempt to open the browser
        const opener = platform() === "win32" ? "start" : platform() === "darwin" ? "open" : "xdg-open";

        try {
            const openerProcess = spawn(opener, [url], { detached: true, stdio: "ignore" });
            openerProcess.on("error", () => {
                logger.info(`Could not automatically open browser. Please visit: ${url}`);
            });
            openerProcess.unref();
        } catch {
            logger.info(`Could not automatically open browser. Please visit: ${url}`);
        }

        logger.info("Press Ctrl+C to stop the file transfer server.");

        // Keep the process alive
        return new Promise(() => {
            // This promise never resolves, keeping the server running until SIGINT
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.fail(`Failed to start file transfer: ${message}`);
    }
}
