import { spawn } from "child_process";
import { startTransferServer, PORT } from "../transfer/server.ts";
import { logger } from "../utils/logger.ts";
import { platform } from "os";

export async function transferCommand(): Promise<void> {
    try {
        // Start the server
        await startTransferServer();

        const url = `http://localhost:${PORT}`;

        // Attempt to open the browser
        const opener = platform() === "win32" ? "start" : platform() === "darwin" ? "open" : "xdg-open";

        try {
            spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
        } catch (e) {
            logger.info(`Could not automatically open browser. Please visit: ${url}`);
        }

        logger.info("Press Ctrl+C to stop the file transfer server.");

        // Keep the process alive
        return new Promise(() => {
            // This promise never resolves, keeping the server running until SIGINT
        });
    } catch (error) {
        logger.fail(`Failed to start file transfer: ${error}`);
    }
}
