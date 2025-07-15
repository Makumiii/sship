import { select as selectFromInquirer } from "@inquirer/prompts";
import type { Tasks } from "./types";
export async function select<T>(message: string, choices: string[]) {
  const answer = await selectFromInquirer({
    message: message,
    choices: choices,
  });
  return answer as unknown as T
}
