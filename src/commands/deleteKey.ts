import { getAllFiles } from "../getAllFiles.ts";
import { select } from "../select.ts";
import { getKeys } from "../getKeys.ts";

const args = Deno.args;
// get files in ssh dir
const location = args[0];
const fullLocation = `${location}/.ssh`;

function deleteSelectedKey(selectedKey: string, files: string[]) {
  const filesToDelete = files.filter((file) => file.includes(selectedKey));

  filesToDelete.forEach((file) => {
    console.log(`Deleting file: ${file}`);
    const filePath = `${fullLocation}/${file}`;

    Deno.removeSync(filePath);
    console.log(`Deleted file: ${filePath}`);
  });

  console.log(`You selected: ${selectedKey}`);
}

async function deleteKey() {
  const pairNames = getKeys(getAllFiles(fullLocation));
  if (pairNames.length === 0) {
    console.log("No keys found to delete");
    return;
  }

  const selectedKey = await select("Select a key to delete", pairNames);

  //   prompt the user for confirmation before deleting

  const deleteResponse = await select(
    `Are you sure you want to delete this key :${selectedKey} ?`,
    ["Yes", "No"],
  );
  if (deleteResponse === "No") {
    console.log("Aborting delete operation");
    return;
  }

  deleteSelectedKey(selectedKey, getAllFiles(fullLocation));
}

await deleteKey();
