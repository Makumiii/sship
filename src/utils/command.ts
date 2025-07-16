import { spawn } from "child_process";

export async function runCommand(scriptPath: string, args: string[] = []) {
    try {
        const command = spawn(scriptPath, args, {
        stdio: 'inherit',
        });
        await new Promise<void>((resolve, reject) => {
            command.on('close', () => resolve());
            command.on('error', reject);
        });
    } catch (error) {
        console.error(`[SSHIP] Error executing command: ${error}`);
        process.exit(1);
    }

}