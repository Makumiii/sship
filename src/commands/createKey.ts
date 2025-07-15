import { promptUser } from "../utils/prompt.ts";
import type { UserPromptMessage } from "../types.ts";
import { spawn } from "bun";
import {resolve} from "path";

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
    message: "Name of key ? (used as part of the name of the SSH key)",
  },
  {
    id: "host",
    message:
      "Name of the host ? This is the host you are trying to use the key with ie github.com",
  },
  {
    id: "user",
    message:
      "Username for the host ? This is the user profile on remote machine ie: for github user git",
  },
  {
    id:'profile',
    message:'The profile you want to use? (server, local , company, personal)',
  }
];

export default async function createKeyCommand() {
  const currentDir = import.meta.dir
  console.log('the current dir is ', currentDir)
  const responses = await promptUser(promptMessages);
  const responsesJson = JSON.stringify(responses);
  const pathToScript = resolve(import.meta.dir, '../../scripts/commands/createKey.sh');

  const command = spawn([pathToScript, responsesJson], {
    stdout:'inherit',
    stderr:'inherit',
    stdin:'inherit',
  });
  await command.exited;
}