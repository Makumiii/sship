import { logger } from "../utils/logger.ts";
import { promptUser } from "../utils/prompt.ts";
import type { UserPromptMessage } from "../types.ts";
import { spawn } from "child_process";
import { resolve, join } from "path";
import { addServiceKey } from "../utils/serviceKeys.ts";

const promptMessages: UserPromptMessage[] = [
  {
    id: "email",
    message: "What is your email address? (used as a comment in the SSH key)",
  },
  {
    id: "passphrase",
    message: "Enter a passphrase (or leave blank for no passphrase)",
  },
  {
    id: "name",
    message: "Name of key? (used as part of the name of the SSH key)",
  },
  {
    id: "host",
    message: "Host name? (e.g. github.com)",
  },
  {
    id: "user",
    message: "Username for the host? (e.g. git for GitHub)",
  },
];

export default async function createKeyCommand(options?: { email?: string; passphrase?: string; name?: string; host?: string; user?: string }) {
  const messages: UserPromptMessage[] = promptMessages.map((msg) => {
    let initialValue: string | undefined;
    switch (msg.id) {
      case "email":
        initialValue = options?.email;
        break;
      case "passphrase":
        initialValue = options?.passphrase;
        break;
      case "name":
        initialValue = options?.name;
        break;
      case "host":
        initialValue = options?.host;
        break;
      case "user":
        initialValue = options?.user;
        break;
    }
    return { ...msg, initialValue };
  });

  const responses = await promptUser(messages);
  const responsesJson = JSON.stringify(responses);
  const pathToScript = join(import.meta.dirname, '../../scripts/commands/createKey.sh');

  const command = spawn(pathToScript, [responsesJson], {
    stdio: 'inherit',
  });
  logger.start("Generating SSH key...");
  const exitCode = await new Promise<number>((resolve, reject) => {
    command.on('close', resolve);
    command.on('error', reject);
  });
  if (exitCode === 0) {
    logger.succeed("SSH key creation complete.");
    if (typeof responses.name === "string" && responses.name.trim() !== "") {
      await addServiceKey(responses.name.trim());
    }
  } else {
    logger.fail("SSH key creation failed.");
  }
}
