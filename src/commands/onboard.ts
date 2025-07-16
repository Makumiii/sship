import { getPrivateKeys } from "../utils/getPrivateKeys.ts";
import { parseSshConfig, type SshConfigEntry } from "./doctor.ts"; // Re-using parseSshConfig and SshConfigEntry
import { promptUser } from "../utils/prompt.ts";
import { select } from "../utils/select.ts";
import { homedir } from "node:os";
import { appendFile } from "node:fs/promises";

const sshConfigLocation = `${homedir()}/.ssh/config`;

// New utility to add an entry to SSH config
async function addSshConfigEntry(alias: string, identityFile: string) {
  const entry = `Host ${alias}\n  IdentityFile ${identityFile}\n`;
  try {
    await appendFile(sshConfigLocation, entry, "utf-8");
    console.log(
      `Added alias '${alias}' for key '${identityFile}' to SSH config.`,
    );
  } catch (error) {
    console.error(`Error adding SSH config entry for '${alias}':`, error);
  }
}

export default async function onboardCommand() {
  console.log("Starting SSH key onboarding...");

  const privateKeys = await getPrivateKeys();
  const configEntries = await parseSshConfig();

  const aliasedKeys = new Set(
    configEntries.map((entry: SshConfigEntry) => entry.identityFile).filter(Boolean),
  );

  const unaliasedPrivateKeys = privateKeys.filter((key) => {
    // Check if the full path of the key is aliased
    const fullPath = `${homedir()}/.ssh/${key}`;
    return !aliasedKeys.has(fullPath);
  });

  if (unaliasedPrivateKeys.length === 0) {
    console.log(
      "No unaliased private keys found. Your SSH setup seems complete!",
    );
    return;
  }

  console.log("Found unaliased private keys:");
  for (const key of unaliasedPrivateKeys) {
    console.log(`- ${key}`);
  }

  for (const key of unaliasedPrivateKeys) {
    const fullKeyPath = `${homedir()}/.ssh/${key}`;
    const action = await select(`What do you want to do with key '${key}'?`, [
      "Add Alias",
      "Add to Profile (Not Implemented Yet)",
      "Skip",
    ]);

    if (action === "Add Alias") {
      const aliasResponse = await promptUser([{ id: 'alias', message: `Enter an alias for '${key}':` }]);
      const alias = aliasResponse.alias;
      if (alias) {
        await addSshConfigEntry(alias, fullKeyPath);
      } else {
        console.log("Alias creation skipped.");
      }
    } else if (action === "Add to Profile (Not Implemented Yet)") {
      console.log("This feature is not yet implemented. Skipping for now.");
    } else {
      console.log(`Skipped key '${key}'.`);
    }
  }

  console.log("Onboarding process finished.");
}
