import { Command } from 'commander';
import { addProfile, removeProfile, renameProfile, getProfileNames, getProfilesData } from '../commands/profile.ts';
import { getRawKeys } from '../commands/listKeys.ts';
import { select } from '../utils/select.ts';
import { promptUser } from '../utils/prompt.ts';

export function registerManageProfilesCommand(program: Command) {
  const profileCommand = program.command('profile')
    .description('Manage SSH connection profiles.');

  profileCommand.command('create <profileName>')
    .description('Create a new profile.')
    .argument('[keys...]', 'List of keys to add to the profile')
    .action(async (profileName: string, keys: string[]) => {
      if (!profileName) {
        console.error("Profile name is required.");
        return;
      }
      if (!keys || keys.length === 0) {
        const availableKeys = getRawKeys();
        if (!availableKeys || availableKeys.length === 0) {
          console.error("No keys available to add to the profile.");
          return;
        }
        keys = await select<string[]>('Select keys to add to the profile:', availableKeys as string[]);
      }
      await addProfile(profileName, keys);
      console.log(`Profile '${profileName}' created/updated successfully.`);
    });

  profileCommand.command('remove <profileName>')
    .description('Remove an existing profile.')
    .action(async (profileName: string) => {
      if (!profileName) {
        console.error("Profile name is required.");
        return;
      }
      await removeProfile(profileName);
      console.log(`Profile '${profileName}' removed.`);
    });

  profileCommand.command('rename <oldName> <newName>')
    .description('Rename an existing profile.')
    .action(async (oldName: string, newName: string) => {
      if (!oldName || !newName) {
        console.error("Both old and new profile names are required.");
        return;
      }
      await renameProfile(newName, oldName);
      console.log(`Profile renamed from '${oldName}' to '${newName}'.`);
    });

  profileCommand.command('list')
    .description('List all available profiles and their keys.')
    .action(async () => {
      const { existingProfiles } = await getProfilesData();
      if (Object.keys(existingProfiles).length === 0) {
        console.log("No profiles found.");
        return;
      }
      console.log("Available Profiles:");
      for (const profileName in existingProfiles) {
        console.log(`  - ${profileName}:`);
        if (Array.isArray(existingProfiles[profileName].ids) && existingProfiles[profileName].ids.length > 0) {
          existingProfiles[profileName].ids.forEach(key => console.log(`    - ${key}`));
        } else {
          console.log("    (No keys associated)");
        }
      }
    });
}
