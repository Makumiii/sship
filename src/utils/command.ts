import { spawn } from "bun";

export async function runCommand(scriptPath: string, args: string[] = []) {
    try {
        const command = spawn([scriptPath, ...args], {
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
        });
        const exitCode = await command.exited;
        return { exitCode };
    } catch (error) {
        console.error(`[SSHIP] Error executing command: ${error}`);
        return { exitCode: 1 }; // Return a non-zero exit code on error
    }

}