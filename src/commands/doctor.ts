import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { select } from "../utils/select.ts";
import { deleteKeyAlias } from "./deleteKey.ts";
const sshConfigLocation = `${homedir()}/.ssh/config`;
export interface SshConfigEntry {
  host: string;
  identityFile?: string;
}
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
      console.log("SSH config file not found. No entries to check.");
      return [];
    }
    console.error("Error reading SSH config:", error);
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
export default async function doctorCommand() {
  console.log("Running SSH config doctor...");
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
    console.log(
      "No missing SSH key files found in your config. Your SSH config is healthy!",
    );
    return;
  }
  console.log("Found missing SSH key files for the following hosts:");
  for (const entry of problematicEntries) {
    console.log(
      `- Host: ${entry.host}, Missing IdentityFile: ${entry.identityFile}`,
    );
  }
  for (const entry of problematicEntries) {
    const confirmDelete = await select(
      `Do you want to delete the config entry for host '${entry.host}' (IdentityFile: ${entry.identityFile})?`,
      ["Yes", "No"],
    );
    if (confirmDelete === "Yes") {
      await deleteKeyAlias(entry.host);
      console.log(`Deleted config entry for host '${entry.host}'.`);
    } else {
      console.log(`Skipped deleting config entry for host '${entry.host}'.`);
    }
  }
  console.log("Doctor utility finished.");
}
