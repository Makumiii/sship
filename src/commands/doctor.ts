import { logger } from "../utils/logger.ts";
import { homedir } from "node:os";
import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { select } from "../utils/select.ts";
import { deleteKeyAlias } from "./deleteKey.ts";
import { loadServiceKeys, removeServiceKey } from "../utils/serviceKeys.ts";
import { loadServers, deleteServer } from "../utils/serverStorage.ts";
import { loadTunnels, clearDeadPids } from "../utils/tunnelStorage.ts";
const sshConfigLocation = `${homedir()}/.ssh/config`;
const sshipDir = join(homedir(), ".sship");
const serviceKeysPath = join(sshipDir, "service-keys.json");
const serversPath = join(sshipDir, "servers.json");
const tunnelsPath = join(sshipDir, "tunnels.json");

export interface SshConfigEntry {
  host: string;
  identityFile?: string;
}

export type DoctorOptions = {
  fixAll?: boolean;
};

export async function parseSshConfig(): Promise<SshConfigEntry[]> {
  try {
    const configContent = await readFile(sshConfigLocation, "utf-8");
    const entries: SshConfigEntry[] = [];
    const hostBlocks = configContent.split(/\n(?=Host\s)/);
    for (const block of hostBlocks) {
      const hostMatch = block.match(/^Host\s+(\S+)/);
      if (!hostMatch) continue;
      const host = hostMatch[1];
      if(!host) continue;
      const identityFileMatch = block.match(/IdentityFile\s+(\S+)/);
      const identityFile = identityFileMatch ? identityFileMatch[1] : undefined;
      entries.push({ host, identityFile });
    }
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.info("SSH config file not found. No entries to check.");
      return [];
    }
    logger.fail(`Error reading SSH config: ${error}`);
    return [];
  }
}
async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureJsonFile(path: string, fallback: string): Promise<boolean> {
  if (!existsSync(path)) return false;

  try {
    JSON.parse(await readFile(path, "utf-8"));
    return false;
  } catch {
    const backupPath = `${path}.invalid-${Date.now()}.bak`;
    await copyFile(path, backupPath);
    await writeFile(path, fallback, "utf-8");
    logger.warn(`Replaced invalid JSON at ${path} (backup: ${backupPath})`);
    return true;
  }
}

async function checkServiceKeyRegistry(fixAll: boolean): Promise<void> {
  const keys = await loadServiceKeys();
  const orphaned: string[] = [];

  for (const key of keys) {
    const keyPath = join(homedir(), ".ssh", key);
    const pubPath = `${keyPath}.pub`;
    const hasPrivate = await checkFileExists(keyPath);
    const hasPublic = await checkFileExists(pubPath);
    if (!hasPrivate && !hasPublic) {
      orphaned.push(key);
    }
  }

  if (orphaned.length === 0) return;

  logger.warn(`Found orphaned service key entries: ${orphaned.join(", ")}`);
  if (!fixAll) return;

  for (const key of orphaned) {
    await removeServiceKey(key);
  }
  logger.info(`Pruned ${orphaned.length} orphaned service key entries.`);
}

async function checkServerRegistry(fixAll: boolean): Promise<void> {
  const servers = await loadServers();
  const broken = [];

  for (const server of servers) {
    const exists = await checkFileExists(server.pemKeyPath);
    if (!exists) {
      broken.push(server);
    }
  }

  if (broken.length === 0) return;

  logger.warn(
    `Found servers with missing PEM files: ${broken.map((s) => `${s.name} (${s.pemKeyPath})`).join(", ")}`
  );
  if (!fixAll) return;

  for (const server of broken) {
    await deleteServer(server.name);
  }
  logger.info(`Removed ${broken.length} server entries with missing PEM files.`);
}

async function checkTunnelRegistry(fixAll: boolean): Promise<void> {
  const tunnels = await loadTunnels();
  const running = tunnels.filter((t) => typeof t.pid === "number");
  if (running.length === 0) return;

  const before = running.length;
  await clearDeadPids();
  const afterState = await loadTunnels();
  const after = afterState.filter((t) => typeof t.pid === "number").length;
  const cleared = before - after;

  if (cleared > 0) {
    logger.warn(`Found ${cleared} stale tunnel PID entr${cleared === 1 ? "y" : "ies"}.`);
    if (fixAll) {
      logger.info(`Cleared ${cleared} stale tunnel PID entr${cleared === 1 ? "y" : "ies"}.`);
    }
  }
}

export default async function doctorCommand(options?: DoctorOptions) {
  const fixAll = Boolean(options?.fixAll);
  logger.start("Running SSH config doctor...");

  if (fixAll) {
    await ensureJsonFile(serviceKeysPath, JSON.stringify({ keys: [] }, null, 2));
    await ensureJsonFile(serversPath, JSON.stringify({ servers: [] }, null, 2));
    await ensureJsonFile(tunnelsPath, JSON.stringify({ tunnels: [] }, null, 2));
  }

  const configEntries = await parseSshConfig();
  const problematicEntries: SshConfigEntry[] = [];
  for (const entry of configEntries) {
    if (entry.identityFile) {
      const exists = await checkFileExists(entry.identityFile);
      if (!exists) {
        problematicEntries.push(entry);
      }
    }
  }
  if (problematicEntries.length === 0) {
    logger.succeed(
      "No missing SSH key files found in your config. Your SSH config is healthy!",
    );
    return;
  }
  logger.info("Found missing SSH key files for the following hosts:");
  for (const entry of problematicEntries) {
    logger.info(
      `- Host: ${entry.host}, Missing IdentityFile: ${entry.identityFile}`,
    );
  }
  for (const entry of problematicEntries) {
    if (fixAll) {
      await deleteKeyAlias(entry.host);
      logger.info(`Deleted config entry for host '${entry.host}'.`);
      continue;
    }

    const confirmDelete = await select(
      `Do you want to delete the config entry for host '${entry.host}' (IdentityFile: ${entry.identityFile})?`,
      ["Yes", "No"],
    );
    if (confirmDelete === "Yes") {
      await deleteKeyAlias(entry.host);
      logger.info(`Deleted config entry for host '${entry.host}'.`);
    } else {
      logger.info(`Skipped deleting config entry for host '${entry.host}'.`);
    }
  }

  await checkServiceKeyRegistry(fixAll);
  await checkServerRegistry(fixAll);
  await checkTunnelRegistry(fixAll);

  logger.succeed("Doctor utility finished.");
}
