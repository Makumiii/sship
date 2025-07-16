import { logger } from "../utils/logger.ts";
import { homedir } from 'os';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import type { SshipUserConfig, SshipUserProfile } from '../types';
import { constants } from 'fs';

const homeLocation = homedir();
const sshipDir = `${homeLocation}/.sship`;
const profileJsonPath = `${sshipDir}/profiles.json`;

// Utility function to ensure directory and file exist
async function ensureProfileInfraExists() {
    try {
        await access(sshipDir, constants.F_OK);
    } catch (e) {
        await mkdir(sshipDir, { recursive: true });
    }

    try {
        await access(profileJsonPath, constants.F_OK);
    } catch (e) {
        const defaultConfig: SshipUserConfig = { profiles: {} };
        await writeFile(profileJsonPath, JSON.stringify(defaultConfig, null, 2));
        logger.succeed(`Created initial profile file at ${profileJsonPath}`);
    }
}

export async function getProfilesData(): Promise<{ existingProfiles: SshipUserProfile, existingData: SshipUserConfig }> {
    await ensureProfileInfraExists();
    try {
        const data = await readFile(profileJsonPath, 'utf-8');
        const existingData = JSON.parse(data) as SshipUserConfig;
        if (!existingData.profiles) {
            existingData.profiles = {};
        }
        const existingProfiles = existingData.profiles as SshipUserProfile;
        return { existingProfiles, existingData };
    } catch (error) {
        logger.fail(`Failed to read or parse profiles from ${profileJsonPath}: ${error}`);
        const defaultConfig: SshipUserConfig = { profiles: {} };
        return { existingProfiles: defaultConfig.profiles, existingData: defaultConfig };
    }
}

async function writeProfilesData(profiles: SshipUserProfile, existingData: SshipUserConfig) {
    await ensureProfileInfraExists();
    try {
        existingData.profiles = profiles;
        await writeFile(profileJsonPath, JSON.stringify(existingData, null, 2));
        logger.succeed(`Profiles written to ${profileJsonPath}`);
    } catch (error) {
        logger.fail(`Failed to write profiles to ${profileJsonPath}: ${error}`);
        throw error;
    }
}

function profileExists(profile:string, data:SshipUserProfile): data is SshipUserProfile & Record<string, {ids: string[]}> {
    if (!data[profile]) {
        return false;
    }
    return true;
}


export async function addProfile(profileName:string, keys:string[]){
    const {existingProfiles:data, existingData} = await getProfilesData()

    if(profileExists(profileName, data)){
        const profile = data[profileName]!;
        if (!profile.ids) {
            profile.ids = [];
        }
        profile.ids.push(...keys);
        await writeProfilesData(data, existingData);
        logger.succeed('Profile updated successfully');
        return;
    }
    
    const newProfile:SshipUserProfile = {
        [profileName]: {
            ids:keys
        }
    }
    const newProfiles:SshipUserProfile = {...data as SshipUserProfile, ...newProfile};
    await writeProfilesData(newProfiles,existingData );
    logger.succeed('Profile created successfully');
    return
    


}

export async function removeProfile(profileName:string){

    const {existingProfiles:data, existingData} = await getProfilesData()

    if (!profileExists(profileName, data)) {
        logger.fail(`Profile ${profileName} does not exist.`);
        return;
    }

    const { [profileName]:unwanted,  ...rest} = data

    await writeProfilesData(rest, existingData);
    logger.succeed(`Profile ${unwanted} removed successfully.`);

}

export async function renameProfile(newName:string, oldName:string){

    const {existingProfiles:data, existingData} = await getProfilesData()


    if (!profileExists(oldName, data)) {
        logger.fail(`Profile ${oldName} does not exist.`);
        return;
    }

    if (profileExists(newName, data)) {
        logger.fail(`Profile ${newName} already exists.`);
        return;
    }

    const profileData = data[oldName];
    delete data[oldName];
    data[newName] = profileData;

    await writeProfilesData(data, existingData);
    logger.succeed(`Profile renamed from ${oldName} to ${newName} successfully.`);

}

export async function getProfileNames(): Promise<string[]> {
    const { existingProfiles } = await getProfilesData();
    return Object.keys(existingProfiles);
}