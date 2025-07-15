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
                console.error("No keys available to add to the profile.");
                return 'mainTask';
            }
            const keys = await select<string[]>('Select keys to add to the profile:', availableKeys as string[]);
            const profileName = promptData['profileName'];
            if (!profileName) {
                console.error("Profile name is required.");
                return 'mainTask';
            }
            await addProfile(profileName, keys);
            return 'mainTask';
        },
        'removeProfile': async () => {
            const profiles = await getProfileNames();
            if (profiles.length === 0) {
                console.log("No profiles to remove.");
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
                console.log("No profiles to rename.");
                return 'mainTask';
            }
            const oldName = await select<string>('Select profile to rename:', profiles);
            if (!oldName) {
                return 'mainTask';
            }
            const promptData = await promptUser([{id: 'newName', message: `Enter new name for ${oldName}:`}]);
            const newName = promptData['newName'];
            if (!newName) {
                console.error("New profile name is required.");
                return 'mainTask';
            }
            await renameProfile(newName, oldName);
            return 'mainTask';
        },
        'storeProfile': async () => {
            console.log("'store' functionality is not yet implemented.");
            return 'mainTask';
        },
        'listProfiles': async () => {
            const { existingProfiles } = await getProfilesData();
            if (Object.keys(existingProfiles).length === 0) {
                console.log("No profiles found.");
                return 'mainTask';
            }
            console.log("Available Profiles:");
            for (const profileName in existingProfiles) {
                console.log(`  - ${profileName}:`);
                if (existingProfiles[profileName].ids && existingProfiles[profileName].ids.length > 0) {
                    existingProfiles[profileName].ids.forEach(key => console.log(`    - ${key}`));
                } else {
                    console.log("    (No keys associated)");
                }
            }
            return 'mainTask';
        }
    }
};

export default profileSequence
