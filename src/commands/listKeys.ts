import {homedir} from 'node:os'
import { getAllFiles } from "../utils/getAllFiles.ts";
import { getKeys } from "../utils/getKeys.ts";
const location = homedir();

const fullLocation = `${location}/.ssh`;

export function getRawKeys() {
  const files = getAllFiles(fullLocation);
  return getKeys(files);
}


export default function listKeysCommand() {
  const pairNames = getRawKeys()
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
