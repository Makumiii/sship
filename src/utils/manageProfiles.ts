import { logger } from "../utils/logger.ts";
import { getRawKeys } from "../commands/listKeys";
import { addProfile, removeProfile, renameProfile, getProfileNames } from "../commands/profile";
import type { NestedRunSequence } from "./nestedNav.ts";
import { promptUser } from "./prompt.ts";
import { select } from "./select.ts";

import { getProfilesData } from "../commands/profile";

const manageProfileTasks = ['create', 'remove', 'rename', 'store', 'list'];
const profileSequence: NestedRunSequence = {
    actionsTracker:[],
    list:{
        'mainTask':async ()=>{
            const selected = await select<string>('select profile management task to run ', manageProfileTasks);
            if(selected === 'create') return 'createProfile';
            if(selected === 'remove') return 'removeProfile';
            if(selected === 'rename') return 'renameProfile';
            if(selected === 'store') return 'storeProfile';
            if(selected === 'list') return 'listProfiles';
            return null;
        },
        'createProfile': async () => {
            const promptData = await promptUser([{id: 'profileName', message: 'Enter profile name:'}]);
            const availableKeys =  getRawKeys();
            if(!availableKeys || availableKeys.length === 0) {
                logger.fail("No keys available to add to the profile.");
                return 'mainTask';
            }
            const keys = await select<string[]>('Select keys to add to the profile:', availableKeys as string[]);
            const profileName = promptData['profileName'];
            if (!profileName) {
                logger.fail("Profile name is required.");
                return 'mainTask';
            }
            await addProfile(profileName, keys);
            return 'mainTask';
        },
        'removeProfile': async () => {
            const profiles = await getProfileNames();
            if (profiles.length === 0) {
                logger.succeed("No profiles to remove.");
                return 'mainTask';
            }
            const profileToRemove = await select<string>('Select profile to remove:', profiles);
            if (profileToRemove) {
                await removeProfile(profileToRemove);
            }
            return 'mainTask';
        },
        'renameProfile': async () => {
            const profiles = await getProfileNames();
            if (profiles.length === 0) {
                logger.succeed("No profiles to rename.");
                return 'mainTask';
            }
            const oldName = await select<string>('Select profile to rename:', profiles);
            if (!oldName) {
                return 'mainTask';
            }
            const promptData = await promptUser([{id: 'newName', message: `Enter new name for ${oldName}:`}]);
            const newName = promptData['newName'];
            if (!newName) {
                logger.fail("New profile name is required.");
                return 'mainTask';
            }
            await renameProfile(newName, oldName);
            return 'mainTask';
        },
        'storeProfile': async () => {
            logger.succeed("'store' functionality is not yet implemented.");
            return 'mainTask';
        },
        'listProfiles': async () => {
            const { existingProfiles } = await getProfilesData();
            if (Object.keys(existingProfiles).length === 0) {
                logger.succeed("No profiles found.");
                return 'mainTask';
            }
            logger.info("Available Profiles:");
            for (const profileName in existingProfiles) {
                logger.info(`  - ${profileName}:`);
                if (Array.isArray(existingProfiles[profileName].ids) && existingProfiles[profileName].ids.length > 0) {
                    existingProfiles[profileName].ids.forEach(key => logger.info(`    - ${key}`));
                } else {
                    logger.info("    (No keys associated)");
                }
            }
            return 'mainTask';
        }
    }
};

export default profileSequence
