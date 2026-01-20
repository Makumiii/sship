import { logger } from "../utils/logger.ts";
import { homedir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { getAllFiles } from "../utils/getAllFiles.ts";
import { getKeys } from "../utils/getKeys.ts";
import { select, type SelectChoice } from "../utils/select.ts";
import { copyToClipboard } from "../utils/clipboard.ts";

const location = homedir();
const fullLocation = `${location}/.ssh`;

export function getRawKeys() {
  const files = getAllFiles(fullLocation);
  return getKeys(files);
}

export default async function listKeysCommand() {
  const pairNames = getRawKeys();

  if (pairNames.length === 0) {
    logger.info("No keys found");
    return;
  }

  logger.info("List of keys:");
  let i = 1;
  pairNames.forEach((key) => {
    logger.info(`${i}. ${key}`);
    i++;
  });

  // Ask if user wants to view a public key
  const validKeys = pairNames.filter((key): key is string => key !== undefined);
  const viewChoices: SelectChoice<string>[] = [
    ...validKeys.map((key) => ({
      name: `🔑  ${key}`,
      value: key,
    })),
    { name: "⬅️   Back", value: "__back__" },
  ];

  const selectedKey = await select<string>(
    "View a public key?",
    viewChoices
  );

  if (!selectedKey || selectedKey === "__back__") {
    return;
  }

  // Read and display the public key
  const pubKeyPath = `${fullLocation}/${selectedKey}.pub`;

  if (!existsSync(pubKeyPath)) {
    logger.fail(`Public key not found: ${pubKeyPath}`);
    return;
  }

  const pubKeyContent = readFileSync(pubKeyPath, "utf-8").trim();

  logger.info("\n📋 Public Key:\n");
  console.log(pubKeyContent);
  console.log("");

  // Copy to clipboard
  const copied = copyToClipboard(pubKeyContent);
  if (copied) {
    logger.succeed("✅ Public key copied to clipboard!");
  } else {
    logger.warn(
      "⚠️  Could not copy to clipboard (no clipboard tool found: xclip, xsel, or wl-copy)"
    );
  }
}
