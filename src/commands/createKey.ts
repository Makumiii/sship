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
];

await promptUser(promptMessages);
