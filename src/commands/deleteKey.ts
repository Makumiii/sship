import { getAllFiles } from "../utils/getAllFiles.ts";
import { select } from "../utils/select.ts";
import { getKeys } from "../utils/getKeys.ts";
import { unlinkSync } from "node:fs";
import {homedir} from 'node:os'
import {readFile, writeFile} from 'fs/promises'

// get files in ssh dir
const location = homedir()
const fullLocation = `${location}/.ssh`;

const sshConfigLocation = `${fullLocation}/config`;

const blockRegex = (alias:string) => new RegExp(`^Host\\s+${alias}\\b(?:\\r?\\n(?!Host\\b)[ \\t]+\\S.*)*`,'m')


async function deleteKeyAlias(alias:string){
  try{
    const config = await readFile(sshConfigLocation, 'utf-8');
    const regex = blockRegex(alias)
    const match = config.match(regex);
    if (!match) {
      console.error(`No matching alias found for: ${alias}`);
      return;
    }
    const newConfig = config.replace(regex, '')
    await writeFile(sshConfigLocation, newConfig, 'utf-8');




  }catch(e){
    console.error("An error occurred while deleting the key alias:", e);
  }

}

function deleteSelectedKey(selectedKey: string, files: string[]) {
  const filesToDelete = files.filter((file) => file.includes(selectedKey));

  filesToDelete.forEach((file) => {
    const filePath = `${fullLocation}/${file}`;

    unlinkSync(filePath);
  });
}

export default async function deleteCommand() {
  const pairNames = getKeys(getAllFiles(fullLocation));
  if (pairNames.length === 0) {
    console.log("No keys found to delete");
    return;
  }

  const choices = pairNames.filter((key) => key !== undefined)

  const selectedKey = await select<string>("Select a key to delete", choices);

  const deleteResponse = await select<'Yes' | 'No'>(
    `Are you sure you want to delete this key :${selectedKey} ?`,
    ["Yes", "No"],
  );
  if (deleteResponse === "No") {
    console.log("Aborting delete operation");
    return;
  }

  deleteSelectedKey(selectedKey, getAllFiles(fullLocation));
  await deleteKeyAlias(selectedKey);
}



