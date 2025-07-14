import { homedir } from 'os';
const homeLocation = homedir()
const profileJsonPath = `${homeLocation}/.sship/profiles.json`;
import { readFile, writeFile } from 'fs/promises';
import type { SshConfTemplate, SshProfiles } from '../types';
import { profile } from 'console';


const data:SshProfiles = await getProfilesData()


async function getProfilesData() {
    try {
        const data = await readFile(profileJsonPath, 'utf-8');
        const existingProfiles = JSON.parse(data) as SshProfiles;
        console.log(`Loaded profiles from ${profileJsonPath}`);
        return existingProfiles;
    } catch (error) {
        console.error(`Failed to read profiles from ${profileJsonPath}:`, error);
        throw error;
    }
}

async function writeProfilesData(profiles: SshProfiles) {
    try {
        await writeFile(profileJsonPath, JSON.stringify(profiles, null, 2));
        console.log(`Profiles written to ${profileJsonPath}`);
    } catch (error) {
        console.error(`Failed to write profiles to ${profileJsonPath}:`, error);
        throw error;
    }
}


function profileExists(profile:string, data:SshProfiles): data is SshProfiles & Record<string, {ids: string[]}> {
    if (!data[profile]) {
        console.error(`Profile ${profile} does not exist.`);
        return false;
    }
    return true;
}


async function addProfile(profileName:string, keys:string[]){
    const data:SshProfiles = await getProfilesData()



    
    if(profileExists(profileName, data)){
        data[profileName]?.ids.push(...keys);
    }


    const newProfile:SshProfiles = {
        [profileName]: {
            ids:keys
        }

    }

    const newProfiles:SshProfiles = {...data, ...newProfile};
    await writeProfilesData(newProfiles);
    console.log('Profile created successfully');



}

async function removeProfile(profileName:string){

    const data:SshProfiles = await getProfilesData()



    if (!profileExists(profileName, data)) {
        console.error(`Profile ${profileName} does not exist.`);
        return;
    }

    const { [profileName]:unwanted,  ...rest} = data

    await writeProfilesData(rest);
    console.log(`Profile ${unwanted} removed successfully.`);

}

async function renameProfile(newName:string, oldName:string){

    const data:SshProfiles = await getProfilesData()


    if (!profileExists(oldName, data)) {
        console.error(`Profile ${oldName} does not exist.`);
        return;
    }

    if (profileExists(newName, data)) {
        console.error(`Profile ${newName} already exists.`);
        return;
    }



    const profileData = data[oldName];
    delete data[oldName];
    data[newName] = profileData;

    await writeProfilesData(data);
    console.log(`Profile renamed from ${oldName} to ${newName} successfully.`);

}