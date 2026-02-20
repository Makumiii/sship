import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ServerConfig } from "../types/serverTypes.ts";

const SSH_DIR = join(homedir(), ".ssh");
const SSH_CONFIG_PATH = join(homedir(), ".ssh", "config");

export function generateSshConfigBlock(server: ServerConfig): string {
    const identityLine =
        server.authMode === "identity_file" && server.identityFile
            ? `    IdentityFile ${server.identityFile}\n    IdentitiesOnly yes\n`
            : "";
    return `
# Added by sship - ${server.name}
Host ${server.name}
    HostName ${server.host}
    Port ${server.port}
    User ${server.user}
${identityLine}`.trimEnd() + "\n";
}

function isHostHeader(line: string): boolean {
    return /^Host\s+/i.test(line);
}

function hostMatches(headerLine: string, host: string): boolean {
    const tokens = headerLine.replace(/^Host\s+/i, "").trim().split(/\s+/).filter(Boolean);
    return tokens.includes(host);
}

function removeHostBlocks(config: string, host: string): string {
    const lines = config.split(/\r?\n/);
    const output: string[] = [];
    let block: string[] = [];
    let blockHeader: string | null = null;

    const flushBlock = () => {
        if (block.length === 0) return;

        if (blockHeader && hostMatches(blockHeader, host)) {
            if (output.length > 0 && output[output.length - 1]?.trim() === `# Added by sship - ${host}`) {
                output.pop();
            }
        } else {
            output.push(...block);
        }

        block = [];
        blockHeader = null;
    };

    for (const line of lines) {
        if (isHostHeader(line)) {
            flushBlock();
            block = [line];
            blockHeader = line;
            continue;
        }

        if (blockHeader) {
            block.push(line);
        } else {
            output.push(line);
        }
    }

    flushBlock();

    const cleaned = output.join("\n").replace(/\n{3,}/g, "\n\n");
    return cleaned.trim() ? `${cleaned.trimEnd()}\n` : "";
}

async function ensureSshConfigFile(): Promise<void> {
    if (!existsSync(SSH_DIR)) {
        await mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
    }
    if (!existsSync(SSH_CONFIG_PATH)) {
        await writeFile(SSH_CONFIG_PATH, "", "utf-8");
    }
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp-${Date.now()}`;
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, filePath);
}

export async function addToSshConfig(server: ServerConfig): Promise<void> {
    await ensureSshConfigFile();
    const currentConfig = await readFile(SSH_CONFIG_PATH, "utf-8");
    const dedupedConfig = removeHostBlocks(currentConfig, server.name);

    const newBlock = generateSshConfigBlock(server);
    const separator = dedupedConfig && !dedupedConfig.endsWith("\n\n") ? "\n" : "";
    await writeAtomic(SSH_CONFIG_PATH, `${dedupedConfig}${separator}${newBlock}`);
}

export async function removeFromSshConfig(serverName: string): Promise<void> {
    if (!existsSync(SSH_CONFIG_PATH)) {
        return;
    }

    const config = await readFile(SSH_CONFIG_PATH, "utf-8");
    const updatedConfig = removeHostBlocks(config, serverName);
    await writeAtomic(SSH_CONFIG_PATH, updatedConfig);
}

export async function updateSshConfig(server: ServerConfig): Promise<void> {
    await removeFromSshConfig(server.name);
    await addToSshConfig(server);
}
