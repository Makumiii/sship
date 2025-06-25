import { select } from "../select.ts";

async function deleteKey() {
  const args = Deno.args;
  // get files in ssh dir
  const location = args[0];
  const fullLocation = `${location}/.ssh`;
  const filesIterator = Deno.readDirSync(fullLocation);
  const files = Array.from(filesIterator).filter((file) => file.isFile).map((
    file,
  ) => file.name);
  const idKeys = files.filter((file) => {
    return (file.endsWith(".pub") || file.endsWith(".pem") ||
      file.endsWith(".pkcs8"));
  });
  const pairName = idKeys.map((file) => {
    const fileNameParts = file.split(".");
    return fileNameParts[0];
  });

  const selectedKey = await select("Select a key to delete", pairName);

//   prompt the user for confirmation before deleting

  const deleteResponse = await select(
    `Are you sure you want to delete this key :${selectedKey} ?`,
    ["Yes", "No"],
  );
  if (deleteResponse === "No") {
    console.log("Aborting delete operation");
    return;
  }

  const filesToDelete = files.filter((file) => file.includes(selectedKey));

  filesToDelete.forEach((file) => {
    console.log(`Deleting file: ${file}`);
    const filePath = `${fullLocation}/${file}`;

    Deno.removeSync(filePath);
    console.log(`Deleted file: ${filePath}`);
  });

  console.log(`You selected: ${selectedKey}`);
}

await deleteKey();
