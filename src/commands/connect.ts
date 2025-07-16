import { logger } from "../utils/logger.ts";
import {readFile} from 'fs/promises'
import { homedir } from 'os';
import { join } from 'path';
import { availableMemory } from 'process';
import { select } from '../utils/select';
import { runCommand } from '../utils/command';
const pathToSshConfig = join(homedir(), '.ssh', 'config');

const regexToUse = /^Host[ \t]+\S+/gm

export async function connectCommand(alias?: string){
    logger.start("Connecting...");

    try{
        const config = await readFile(pathToSshConfig,'utf-8')
        const matches = config.match(regexToUse);
        const availableAliases = matches?.map((match)=> match.split(' ')[1])

        if(!availableAliases || availableAliases.length === 0) {
            logger.fail("No SSH aliases found in the config file.");
            return;
        }
        logger.succeed("SSH aliases found.");

        let selectedAlias: string;
        if (alias) {
            if (!availableAliases.includes(alias)) {
                logger.fail(`Alias '${alias}' not found in SSH config.`);
                return;
            }
            selectedAlias = alias;
        } else {
            selectedAlias = await select<string>('Select an SSH alias to connect:', availableAliases as string[]);
        }
        
        await runCommand('ssh', [selectedAlias])
        logger.succeed(`Connected to ${selectedAlias}`);
        

    }catch(e){
        logger.fail(`An error occurred while connecting: ${e}`);
    }
}