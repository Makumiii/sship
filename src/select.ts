import { select as selectFromInquirer } from "@inquirer/prompts";
export async function select(message: string, choices: string[]) {
  const answer = await selectFromInquirer({
    message: message,
    choices: choices,
  });
  return answer as unknown as string;
}
