import { spawn } from "bun";

export async function runCommand(scriptPath: string, args: string[] = []) {
    try {
        const command = spawn([scriptPath, ...args], {
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
        });
        await command.exited;
    } catch (error) {
        console.error(`[SSHIP] Error executing command: ${error}`);
        process.exit(1);
    }

}