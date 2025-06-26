import { writeResponses } from "./io.ts";
import { select } from "./select.ts";

const appTasks = ["create", "delete", "backup", "list"];

const chosenTask = await select("What do you want to do?", appTasks);
writeResponses({ chosenTask }, "task");
