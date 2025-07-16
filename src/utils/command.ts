import { spawn } from "bun";
import { logger } from "./logger.ts";

export async function runCommand(scriptPath: string, args: string[] = []) {
    logger.info(`[SSHIP] Running command: ${scriptPath} ${args.join(' ')}`);
    try {
        const command = spawn([scriptPath, ...args], {
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
        });
        const exitCode = await command.exited;
        logger.info(`[SSHIP] Command finished with exit code: ${exitCode}`);
        return { exitCode };
    } catch (error) {
        logger.fail(`[SSHIP] Error executing command: ${error}`);
        return { exitCode: 1 }; // Return a non-zero exit code on error
    }

}