import { select } from "./select.ts";
import { ExitPromptError } from "@inquirer/core";
import { spawn } from "bun";

const appTasks = ["create", "delete", "backup", "list", 'uninstall'];

try {
  const chosenTask = await select("What do you want to do?", appTasks);
  console.log(chosenTask)
  const command = spawn([`${import.meta.dir}/run.sh`, chosenTask], {
    stdout:'inherit',
    stderr:'inherit',
    stdin:'inherit',
  })
  await command.exited
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

