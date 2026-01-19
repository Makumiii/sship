import { logger } from "../utils/logger.ts";
import { getPrivateKeys } from "../utils/getPrivateKeys.ts";
import { parseSshConfig, type SshConfigEntry } from "./doctor.ts";
import { promptUser } from "../utils/prompt.ts";
import { select } from "../utils/select.ts";
import { homedir } from "node:os";
import { appendFile } from "node:fs/promises";

const sshConfigLocation = `${homedir()}/.ssh/config`;

async function addSshConfigEntry(alias: string, identityFile: string) {
  const entry = `Host ${alias}\n  IdentityFile ${identityFile}\n`;
  try {
    await appendFile(sshConfigLocation, entry, "utf-8");
    logger.info(
      `Added alias '${alias}' for key '${identityFile}' to SSH config.`,
    );
  } catch (error) {
    logger.fail(`Error adding SSH config entry for '${alias}': ${error}`);
  }
}

export default async function onboardCommand() {
  logger.start("Starting SSH key onboarding...");

  const privateKeys = await getPrivateKeys();
  const configEntries = await parseSshConfig();

  const aliasedKeys = new Set(
    configEntries
      .map((entry: SshConfigEntry) => entry.identityFile)
      .filter(Boolean),
  );

  const unaliasedPrivateKeys = privateKeys.filter((key) => {
    const fullPath = `${homedir()}/.ssh/${key}`;
    return !aliasedKeys.has(fullPath);
  });

  if (unaliasedPrivateKeys.length === 0) {
    logger.succeed(
      "No unaliased private keys found. Your SSH setup seems complete!",
    );
    return;
  }

  logger.info("Found unaliased private keys:");
  for (const key of unaliasedPrivateKeys) {
    logger.info(`- ${key}`);
  }

  for (const key of unaliasedPrivateKeys) {
    const fullKeyPath = `${homedir()}/.ssh/${key}`;
    const action = await select(`What do you want to do with key '${key}'?`, [
      "Add Alias",
      "Skip",
    ]);

    if (action === "Add Alias") {
      const aliasResponse = await promptUser([
        { id: "alias", message: `Enter an alias for '${key}':` },
      ]);
      const alias = aliasResponse.alias;
      if (alias) {
        await addSshConfigEntry(alias, fullKeyPath);
      } else {
        logger.info("Alias creation skipped.");
      }
    } else {
      logger.info(`Skipped key '${key}'.`);
    }
  }

  logger.succeed("Onboarding process finished.");
}

