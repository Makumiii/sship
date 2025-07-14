import { select } from "./select.ts";
import { ExitPromptError } from "@inquirer/core";
import deleteCommand, * as deleteKey   from "./commands/deleteKey.ts"; 
import type { Tasks } from "./types.ts";
import createKeyCommand from "./commands/createKey.ts";
import listKeysCommand from "./commands/listKeys.ts";
import { runCommand } from "./command.ts";
import backupCommand from "./commands/backup.ts";


const appTasks: Tasks[] = ["create", "delete", "backup", "list", 'uninstall'] ;

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
      await runCommand('./uninstall.sh')
      break;
    }

  }



} catch (error) {
  if (error instanceof ExitPromptError) {
    console.log("\n[SSHIP] main.ts: Aborted. Exiting gracefully.");
    process.exit(130);
  } else {
    console.error("[SSHIP] main.ts: An unexpected error occurred:", error);
  }
}

process.on('SIGINT', ()=>{
  console.log("\n[SSHIP] main.ts: SIGINT received. Exiting gracefully.");
  process.exit(130);
})