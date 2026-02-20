import { logger } from "../utils/logger.ts";
import { promptUser } from "../utils/prompt.ts";
import type { UserPromptMessage } from "../types.ts";
import { spawn } from "child_process";
import { addServiceKey } from "../utils/serviceKeys.ts";
import { resolveScriptPath } from "../utils/scriptPath.ts";
import { select } from "../utils/select.ts";
import { ensureIdentityInAgent } from "../utils/sshAgent.ts";
import {
  SERVICE_KEY_TEMPLATES,
  getServiceKeyTemplate,
  type ServiceKeyTemplate,
} from "../utils/serviceKeyTemplates.ts";
import { homedir } from "node:os";
import { join } from "node:path";

const basePromptMessages: UserPromptMessage[] = [
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
];

export type CreateKeyOptions = {
  email?: string;
  passphrase?: string;
  name?: string;
  host?: string;
  user?: string;
  template?: string;
  listTemplates?: boolean;
};

function hasAnyCreateInput(options?: CreateKeyOptions): boolean {
  if (!options) return false;
  return Boolean(
    options.email ||
      options.passphrase ||
      options.name ||
      options.host ||
      options.user ||
      options.template
  );
}

function logTemplateList(): void {
  console.log("Available service key templates:");
  for (const template of SERVICE_KEY_TEMPLATES) {
    const target =
      template.defaultHost && template.defaultUser
        ? ` (${template.defaultUser}@${template.defaultHost})`
        : "";
    const docs = template.docsUrl ? ` | ${template.docsUrl}` : "";
    console.log(`- ${template.id}: ${template.label}${target} - ${template.description}${docs}`);
  }
}

async function pickTemplateInteractively(): Promise<ServiceKeyTemplate> {
  const choices = SERVICE_KEY_TEMPLATES.map((template) => ({
    name:
      template.defaultHost && template.defaultUser
        ? `${template.label} (${template.defaultUser}@${template.defaultHost})`
        : `${template.label}`,
    value: template.id,
  }));

  const selectedTemplateId = await select<string>("Select service template:", choices);
  return getServiceKeyTemplate(selectedTemplateId) ?? SERVICE_KEY_TEMPLATES[SERVICE_KEY_TEMPLATES.length - 1]!;
}

export default async function createKeyCommand(options?: CreateKeyOptions) {
  if (options?.listTemplates) {
    logTemplateList();
    return;
  }

  let selectedTemplate: ServiceKeyTemplate | undefined;
  if (options?.template) {
    selectedTemplate = getServiceKeyTemplate(options.template.trim());
    if (!selectedTemplate) {
      logger.fail(`Unknown template "${options.template}". Use --list-templates to see available templates.`);
      return;
    }
  } else if (!hasAnyCreateInput(options) && process.stdin.isTTY) {
    selectedTemplate = await pickTemplateInteractively();
  } else {
    selectedTemplate = getServiceKeyTemplate("custom");
  }

  const resolvedHost = options?.host ?? selectedTemplate?.defaultHost;
  const resolvedUser = options?.user ?? selectedTemplate?.defaultUser;

  const promptMessages: UserPromptMessage[] = [
    ...basePromptMessages,
    {
      id: "host",
      message: "Host name? (e.g. github.com)",
      initialValue: resolvedHost,
    },
    {
      id: "user",
      message: "Username for the host? (e.g. git for GitHub)",
      initialValue: resolvedUser,
    },
  ];

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
        initialValue = msg.initialValue;
        break;
      case "user":
        initialValue = msg.initialValue;
        break;
    }
    return { ...msg, initialValue };
  });

  const responses = await promptUser(messages);
  const responsesJson = JSON.stringify(responses);
  const pathToScript = resolveScriptPath(import.meta.dirname, "commands/createKey.sh");

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
    const keyName = typeof responses.name === "string" ? responses.name.trim() : "";
    if (keyName !== "") {
      await addServiceKey(keyName);
      const keyPath = join(homedir(), ".ssh", keyName);
      const agentStatus = await ensureIdentityInAgent(keyPath, { interactive: true });
      if (agentStatus === "added") {
        logger.info(`Loaded key into ssh-agent: ${keyPath}`);
      } else if (agentStatus === "skipped_no_agent") {
        logger.warn("SSH_AUTH_SOCK is not set; key was created but not loaded into ssh-agent.");
      } else if (agentStatus === "failed") {
        logger.warn(`Could not load key into ssh-agent automatically: ${keyPath}`);
      }
    }
    if (selectedTemplate?.docsUrl) {
      logger.info(`Add your public key in ${selectedTemplate.label}: ${selectedTemplate.docsUrl}`);
    }
  } else {
    logger.fail("SSH key creation failed.");
  }
}
