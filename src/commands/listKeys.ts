import {homedir} from 'node:os'
import { getAllFiles } from "../getAllFiles.ts";
import { getKeys } from "../getKeys.ts";
const location = homedir();

const fullLocation = `${location}/.ssh`;


export default function listKeysCommand() {
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

}
