const args = process.argv.slice(2);
const location = args[0];
const fullLocation = `${location}/.ssh`;
import { getAllFiles } from "../getAllFiles.ts";
import { getKeys } from "../getKeys.ts";

const files = getAllFiles(fullLocation);
const pairNames = getKeys(files);
if (pairNames.length === 0) {
  console.log("No keys found");
} else {
  console.log("List of keys:");
  let i = 1;
  pairNames.forEach((key) => {
    console.log(`${i}. ${key}`);
    i++;
  });
}
