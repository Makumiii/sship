import { input } from "@inquirer/prompts";
import { UserPromptMessage } from "./types.ts";
import { writeResponses } from "./io.ts";

export async function promptUser(message: UserPromptMessage[]) {
  const responses: Record<string, string> = {};
  for (const msg of message) {
    const answer = await input({ message: msg.message });
    responses[msg.id] = answer;
  }

  writeResponses(responses, "create");
}
