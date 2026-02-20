import { spawn } from "child_process";

export async function runCommand(scriptPath: string, args: string[] = []): Promise<number> {
    const command = spawn(scriptPath, args, {
        stdio: "inherit",
    });

    return await new Promise<number>((resolve) => {
        command.on("close", (code) => resolve(code ?? 1));
        command.on("error", () => resolve(1));
    });
}
