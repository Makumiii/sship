import { writeResponses } from "./io.ts";
import { select } from "./select.ts";
import { ExitPromptError } from "npm:@inquirer/core";

const appTasks = ["create", "delete", "backup", "list", 'uninstall'];

try {
  const chosenTask = await select("What do you want to do?", appTasks);
  writeResponses({ chosenTask }, "task");
} catch (error) {
  if (error instanceof ExitPromptError) {
    console.log("\n[SSHIP] main.ts: Aborted. Exiting gracefully.");
    Deno.exit(130);
  } else {
    console.error("[SSHIP] main.ts: An unexpected error occurred:", error);
  }
}

