import { logger } from "../utils/logger.ts";
import { homedir } from 'node:os'
import { join } from 'node:path';
import { getAllFiles } from "../utils/getAllFiles.ts";
import { getKeys } from "../utils/getKeys.ts";
const location = homedir();

const fullLocation = join(location, '.ssh');

export function getRawKeys() {
  const files = getAllFiles(fullLocation);
  return getKeys(files);
}


export default function listKeysCommand() {
  const pairNames = getRawKeys()
  if (pairNames.length === 0) {
    logger.info("No keys found");
  } else {
    logger.info("List of keys:");
    let i = 1;
    pairNames.forEach((key) => {
      logger.info(`${i}. ${key}`);
      i++;
    });
  }

}
