import { input } from "@inquirer/prompts";
import type { UserPromptMessage } from "../types.ts";
import { writeResponses } from "./io.ts";

export async function promptUser(message: UserPromptMessage[]) {
  const responses: Record<string, string> = {};
  for (const msg of message) {
    if (msg.initialValue !== undefined && msg.initialValue !== null) {
      responses[msg.id] = msg.initialValue;
    } else {
      const answer = await input({ message: msg.message });
      responses[msg.id] = answer;
    }
  }

  return responses;
}
