import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { ServerConfig } from "../types/serverTypes.ts";
import { loadServiceKeys } from "./serviceKeys.ts";

const SSH_DIR = join(homedir(), ".ssh");
const SSH_CONFIG_PATH = join(homedir(), ".ssh", "config");

export function generateSshConfigBlock(server: ServerConfig): string {
    const identityLine =
        server.authMode === "identity_file" && server.identityFile
            ? `    IdentityFile ${server.identityFile}\n    IdentitiesOnly yes\n    AddKeysToAgent yes\n`
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

function isPotentialOrphanHeader(line: string): boolean {
    const trimmed = line.trim();
    return Boolean(trimmed) && !trimmed.startsWith("#") && !/\s/.test(trimmed);
}

function identityFileFromBlock(lines: string[]): string | undefined {
    const identityLine = lines.find((line) => /^\s*IdentityFile\s+/i.test(line));
    return identityLine?.trim().split(/\s+/)[1];
}

function hostNameFromBlock(lines: string[]): string | undefined {
    const hostNameLine = lines.find((line) => /^\s*HostName\s+/i.test(line));
    return hostNameLine?.trim().split(/\s+/)[1];
}

function userFromBlock(lines: string[]): string | undefined {
    const userLine = lines.find((line) => /^\s*User\s+/i.test(line));
    return userLine?.trim().split(/\s+/)[1];
}

function identityBelongsToAlias(identityFile: string | undefined, alias: string): boolean {
    if (!identityFile) return false;
    return basename(identityFile) === alias || identityFile === join(SSH_DIR, alias);
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

type ConfigBlock = {
    kind: "host" | "orphan";
    lines: string[];
};

function parseConfigBlocks(config: string): Array<string | ConfigBlock> {
    const lines = config.split(/\r?\n/);
    const units: Array<string | ConfigBlock> = [];
    let block: ConfigBlock | null = null;

    const flushBlock = () => {
        if (!block) return;
        units.push(block);
        block = null;
    };

    for (const line of lines) {
        if (isHostHeader(line)) {
            flushBlock();
            block = { kind: "host", lines: [line] };
            continue;
        }

        if (!block && isPotentialOrphanHeader(line)) {
            block = { kind: "orphan", lines: [line] };
            continue;
        }

        if (block) {
            const startsNewTopLevelLine = line.trim() && !/^\s/.test(line) && !line.trim().startsWith("#");
            if (startsNewTopLevelLine) {
                flushBlock();
                units.push(line);
                continue;
            }
            block.lines.push(line);
        } else {
            units.push(line);
        }
    }

    flushBlock();
    return units;
}

function serviceKeyBlock(alias: string, host: string, user: string, identityFile: string): string {
    return `Host ${alias} ${host}
    HostName ${host}
    User ${user}
    IdentityFile ${identityFile}
    AddKeysToAgent yes
`;
}

function normalizeConfig(content: string): string {
    const cleaned = content.replace(/\n{3,}/g, "\n\n").trimEnd();
    return cleaned ? `${cleaned}\n` : "";
}

export function removeServiceKeySshConfigBlocks(config: string, alias: string): string {
    const units = parseConfigBlocks(config);
    const kept: string[] = [];

    for (const unit of units) {
        if (typeof unit === "string") {
            kept.push(unit);
            continue;
        }

        const header = unit.lines[0] ?? "";
        const identityFile = identityFileFromBlock(unit.lines);
        const shouldRemove =
            (unit.kind === "host" && hostMatches(header, alias)) ||
            identityBelongsToAlias(identityFile, alias);

        if (!shouldRemove) {
            kept.push(...unit.lines);
        }
    }

    return normalizeConfig(kept.join("\n"));
}

export type ServiceKeySshConfigRepairResult = {
    repaired: boolean;
    backupPath?: string;
};

export function repairServiceKeySshConfigContent(config: string, serviceKeys: string[]): string {
    let nextConfig = config;

    for (const alias of serviceKeys) {
        const units = parseConfigBlocks(nextConfig);
        const matchingBlocks = units
            .filter((unit): unit is ConfigBlock => typeof unit !== "string")
            .filter((block) => {
                const header = block.lines[0] ?? "";
                const identityFile = identityFileFromBlock(block.lines);
                return (block.kind === "host" && hostMatches(header, alias)) || identityBelongsToAlias(identityFile, alias);
            });

        const hasMalformedBlock = matchingBlocks.some((block) => block.kind === "orphan");
        if (matchingBlocks.length <= 1 && !hasMalformedBlock) {
            continue;
        }

        const preferred = matchingBlocks.find((block) => block.kind === "host") ?? matchingBlocks[0];
        if (!preferred) continue;

        const host = hostNameFromBlock(preferred.lines) ?? preferred.lines[0]?.trim() ?? alias;
        const user = userFromBlock(preferred.lines) ?? "git";
        const identityFile = identityFileFromBlock(preferred.lines) ?? join(SSH_DIR, alias);

        nextConfig = removeServiceKeySshConfigBlocks(nextConfig, alias);
        const separator = nextConfig && !nextConfig.endsWith("\n\n") ? "\n" : "";
        nextConfig = `${nextConfig}${separator}${serviceKeyBlock(alias, host, user, identityFile)}`;
    }

    return normalizeConfig(nextConfig);
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

export async function removeServiceKeyFromSshConfig(alias: string): Promise<boolean> {
    if (!existsSync(SSH_CONFIG_PATH)) {
        return false;
    }

    const config = await readFile(SSH_CONFIG_PATH, "utf-8");
    const updatedConfig = removeServiceKeySshConfigBlocks(config, alias);
    if (updatedConfig === config) {
        return false;
    }

    await writeAtomic(SSH_CONFIG_PATH, updatedConfig);
    return true;
}

export async function repairServiceKeySshConfig(serviceKeys?: string[]): Promise<ServiceKeySshConfigRepairResult> {
    if (!existsSync(SSH_CONFIG_PATH)) {
        return { repaired: false };
    }

    const keys = serviceKeys ?? await loadServiceKeys();
    if (keys.length === 0) {
        return { repaired: false };
    }

    const config = await readFile(SSH_CONFIG_PATH, "utf-8");
    const repairedConfig = repairServiceKeySshConfigContent(config, keys);
    if (repairedConfig === config) {
        return { repaired: false };
    }

    const backupPath = `${SSH_CONFIG_PATH}.backup-${Date.now()}`;
    await copyFile(SSH_CONFIG_PATH, backupPath);
    await writeAtomic(SSH_CONFIG_PATH, repairedConfig);
    return { repaired: true, backupPath };
}
