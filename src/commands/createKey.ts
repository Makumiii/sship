import { promptUser } from "../prompt.ts";
import { UserPromptMessage } from "../types.ts";

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
];

await promptUser(promptMessages);
