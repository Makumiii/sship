import { getAllFiles } from "../getAllFiles.ts";
import { select } from "../select.ts";
import { getKeys } from "../getKeys.ts";
import { unlinkSync } from "node:fs";
import {homedir} from 'node:os'

// get files in ssh dir
const location = homedir()
const fullLocation = `${location}/.ssh`;

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
}


