import { logger } from "../utils/logger.ts";
import { getAllFiles } from "../utils/getAllFiles.ts";
import { select } from "../utils/select.ts";
import { getKeys } from "../utils/getKeys.ts";
import { unlinkSync } from "node:fs";
import {homedir} from 'node:os'
import {readFile, writeFile} from 'fs/promises'
import { isWindows } from "../utils/osDetect.ts";
import { runCommand } from "../utils/command.ts";
import { resolve, join } from "path";

// get files in ssh dir
const location = homedir()
const fullLocation = join(location, '.ssh');

const sshConfigLocation = join(fullLocation, 'config');

const blockRegex = (alias:string) => new RegExp(`^Host\\s+${alias}\\b(?:\\r?\\n(?!Host\\b)[ \\t]+\\S.*)*`,'m')


export async function deleteKeyAlias(alias:string){
  try{
    const config = await readFile(sshConfigLocation, 'utf-8');
    const regex = blockRegex(alias)
    const match = config.match(regex);
    if (!match) {
      logger.fail(`No matching alias found for: ${alias}`);
      return;
    }
    const newConfig = config.replace(regex, '')
    await writeFile(sshConfigLocation, newConfig, 'utf-8');




  }catch(e){
    logger.fail(`An error occurred while deleting the key alias: ${e}`);
  }

}

async function deleteSelectedKey(selectedKey: string, files: string[]) {
  const filesToDelete = files.filter((file) => file.includes(selectedKey));

  const scriptExtension = isWindows() ? '.ps1' : '.sh';
  const scriptDir = isWindows() ? '../../scripts/powershell/commands' : '../../scripts/bash/commands';
  const pathToScript = resolve(import.meta.dir, `${scriptDir}/deleteFile${scriptExtension}`);

  for (const file of filesToDelete) {
    const filePath = join(fullLocation, file);
    if (isWindows()) {
      await runCommand('powershell.exe', ['-File', pathToScript, filePath]);
    } else {
      await runCommand(pathToScript, [filePath]);
    }
  }
}

export default async function deleteCommand(keyName?: string, yes?: boolean) {
  const pairNames = getKeys(getAllFiles(fullLocation));
  if (pairNames.length === 0) {
    logger.info("No keys found to delete");
    return;
  }

  const choices = pairNames.filter((key) => key !== undefined);
  let selectedKey: string;

  if (keyName) {
    if (!choices.includes(keyName)) {
      logger.fail(`Key '${keyName}' not found.`);
      return;
    }
    selectedKey = keyName;
  } else {
    selectedKey = await select<string>("Select a key to delete", choices);
  }

  let deleteResponse: 'Yes' | 'No';
  if (yes) {
    deleteResponse = "Yes";
  } else {
    deleteResponse = await select<'Yes' | 'No'>(
      `Are you sure you want to delete this key :${selectedKey} ?`,
      ["Yes", "No"],
    );
  }

  if (deleteResponse === "No") {
    logger.info("Aborting delete operation");
    return;
  }

  deleteSelectedKey(selectedKey, getAllFiles(fullLocation));
  await deleteKeyAlias(selectedKey);
}



