import { readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { existsSync } from "fs";
import { join } from "path";
import type { ServerConfig } from "../types/serverTypes.ts";

const SSH_CONFIG_PATH = join(homedir(), ".ssh", "config");

export function generateSshConfigBlock(server: ServerConfig): string {
    return `
# Added by sship - ${server.name}
Host ${server.name}
    HostName ${server.host}
    Port ${server.port}
    User ${server.user}
    IdentityFile ${server.pemKeyPath}
    IdentitiesOnly yes
`;
}

export async function addToSshConfig(server: ServerConfig): Promise<void> {
    let currentConfig = "";
    if (existsSync(SSH_CONFIG_PATH)) {
        currentConfig = await readFile(SSH_CONFIG_PATH, "utf-8");
    }

    // Check if entry already exists
    const hostPattern = new RegExp(`^Host\\s+${server.name}\\s*$`, "m");
    if (hostPattern.test(currentConfig)) {
        // Remove existing entry first
        await removeFromSshConfig(server.name);
        currentConfig = await readFile(SSH_CONFIG_PATH, "utf-8");
    }

    const newBlock = generateSshConfigBlock(server);
    await writeFile(SSH_CONFIG_PATH, currentConfig + newBlock);
}

export async function removeFromSshConfig(serverName: string): Promise<void> {
    if (!existsSync(SSH_CONFIG_PATH)) {
        return;
    }

    const config = await readFile(SSH_CONFIG_PATH, "utf-8");

    // Match the entire block including the comment and all indented lines
    const blockPattern = new RegExp(
        `\\n?# Added by sship - ${serverName}\\nHost ${serverName}\\n(?:[ \\t]+[^\\n]+\\n)*`,
        "g"
    );

    const updatedConfig = config.replace(blockPattern, "");
    await writeFile(SSH_CONFIG_PATH, updatedConfig);
}

export async function updateSshConfig(server: ServerConfig): Promise<void> {
    await removeFromSshConfig(server.name);
    await addToSshConfig(server);
}
