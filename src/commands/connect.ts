import {readFile} from 'fs/promises'
import { homedir } from 'os';
import { availableMemory } from 'process';
import { select } from '../select';
import { runCommand } from '../command';
const pathToSshConfig = `${homedir()}/.ssh/config`;

const regexToUse = /^Host[ \t]+\S+/gm

export async function connectCommand(){

    try{
        const config = await readFile(pathToSshConfig,'utf-8')
        const matches = config.match(regexToUse);
        const availableAliases = matches?.map((match)=> match.split(' ')[1])

        if(!availableAliases || availableAliases.length === 0) {
            console.error("No SSH aliases found in the config file.");
            return;
        }

        const selectedAlias = await select<string>('Select an SSH alias to connect:', availableAliases as string[]);
        await runCommand('ssh', [selectedAlias])
        

    }catch(e){
        console.error("An error occurred while connecting:", e);
    }
}