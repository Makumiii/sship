import { logger } from "../utils/logger.ts";
import { getPrivateKeys } from "../utils/getPrivateKeys.ts";
import { parseSshConfig, type SshConfigEntry } from "./doctor.ts"; // Re-using parseSshConfig and SshConfigEntry
import { promptUser } from "../utils/prompt.ts";
import { select } from "../utils/select.ts";
import { homedir } from "node:os";
import { getProfileNames, addProfile } from "../commands/profile.ts";
import { appendFile } from "node:fs/promises";

const sshConfigLocation = `${homedir()}/.ssh/config`;

// New utility to add an entry to SSH config
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
    // Check if the full path of the key is aliased
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
      "Add to Profile",
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
    } else if (action === "Add to Profile (Not Implemented Yet)") {
      const profileNames = await getProfileNames();
      let selectedProfile: string = "";

      if (profileNames.length === 0) {
        const newProfileResponse = await promptUser([
          {
            id: "newProfileName",
            message: "No profiles found. Enter a name for the new profile:",
          },
        ]);
        if(!newProfileResponse.newProfileName) {
          logger.info("Profile creation skipped.");
          continue;
        }

        selectedProfile = newProfileResponse.newProfileName;
      } else {
        const profileChoice = await select(
          "Select a profile or create a new one:",
          [...profileNames, "Create New Profile"],
        );

        if (profileChoice === "Create New Profile") {
          const newProfileResponse = await promptUser([
            {
              id: "newProfileName",
              message: "Enter a name for the new profile:",
            },
          ]);

          if (!newProfileResponse.newProfileName) {
            logger.info("Profile creation skipped.");
            continue;
          }
          selectedProfile = newProfileResponse.newProfileName;
        } else {
          if(typeof profileChoice !== "string") {
            logger.fail("Invalid profile selection.");
            continue;
          }
          selectedProfile = profileChoice;
        }
      }

      if (selectedProfile) {
        await addProfile(selectedProfile, [key]); // Add the key to the selected/new profile
        logger.info(`Added key '${key}' to profile '${selectedProfile}'.`);
      } else {
        logger.info("Profile addition skipped.");
      }
    } else {
      logger.info(`Skipped key '${key}'.`);
    }
  }

  logger.succeed("Onboarding process finished.");
}
