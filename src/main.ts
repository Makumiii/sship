import { logger } from "./utils/logger.ts";
import { select } from "./utils/select.ts";
import { ExitPromptError } from "@inquirer/core";
import deleteCommand from "./commands/deleteKey.ts"; 
import type { Tasks } from "./types.ts";
import createKeyCommand from "./commands/createKey.ts";
import listKeysCommand from "./commands/listKeys.ts";
import { runCommand } from "./utils/command.ts";
import backupCommand from "./commands/backup.ts";
import { runNested } from "./utils/nestedNav.ts";
import profileSequence from "./utils/manageProfiles.ts";
import { connectCommand } from "./commands/connect.ts";
import doctorCommand from "./commands/doctor.ts";
import onboardCommand from "./commands/onboard.ts";


const appTasks: Tasks[] = ["create", "delete", "backup", "list", 'uninstall', 'manageProfiles', "connect", "doctor", "onboard"] ;

try {
  const chosenTask = await select<Tasks>("What do you want to do?", appTasks);
  switch(chosenTask){
    case 'create': {
      await createKeyCommand()
      break;
    }
    case 'delete': {
      await deleteCommand()

      break;
      
    }
    case 'list':{
      listKeysCommand()
      break
    }
    case 'backup': {
      await backupCommand()
      break;
    }
    case 'uninstall': {
      await runCommand('../scripts/uninstall.sh')
      break;
    }
    case 'manageProfiles' : {

      await runNested(profileSequence)
      break;

    
    }

    case 'connect': {
      await connectCommand()
      break;
    }
    case 'doctor': {
      await doctorCommand()
      break;
    }
    case 'onboard': {
      await onboardCommand()
      break;
    }

  }



} catch (error) {
  if (error instanceof ExitPromptError) {
    logger.info("\n[SSHIP] main.ts: Aborted. Exiting gracefully.");
    process.exit(130);
  } else {
    logger.fail(`[SSHIP] main.ts: An unexpected error occurred: ${error}`);
  }
}

process.on('SIGINT', ()=>{
  logger.info("\n[SSHIP] main.ts: SIGINT received. Exiting gracefully.");
  process.exit(130);
})