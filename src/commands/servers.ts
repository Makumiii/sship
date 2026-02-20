import { input, password } from "@inquirer/prompts";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { logger } from "../utils/logger.ts";
import { select } from "../utils/select.ts";
import { runCommand } from "../utils/command.ts";
import {
  loadServers,
  addServer,
  getServer,
  updateServer,
  deleteServer,
  copyIdentityToSsh,
} from "../utils/serverStorage.ts";
import {
  addToSshConfig,
  removeFromSshConfig,
  updateSshConfig,
} from "../utils/sshConfig.ts";
import type { ServerAuthMode, ServerConfig } from "../types/serverTypes.ts";
import type { SelectChoice } from "../utils/select.ts";
import {
  installPublicKeyOnServer,
  prepareBootstrapKey,
  verifyIdentityFileConnection,
} from "../utils/serverBootstrap.ts";
import { ensureIdentityInAgent } from "../utils/sshAgent.ts";

type ServerAction = "add" | "manage" | "back";

function getExistingPrivateKeyFiles(): string[] {
  const sshDir = join(homedir(), ".ssh");
  if (!existsSync(sshDir)) {
    return [];
  }
  try {
    const files = readdirSync(sshDir, { withFileTypes: true });
    return files
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => {
        if (name.endsWith(".pub")) return false;
        if (["config", "known_hosts", "known_hosts.old", "authorized_keys"].includes(name)) {
          return false;
        }
        return true;
      });
  } catch {
    return [];
  }
}

function buildSshArgs(server: ServerConfig, mode: "connect" | "test"): string[] {
  const args: string[] = ["-p", String(server.port), "-o", "ConnectTimeout=10"];

  if (server.authMode === "identity_file") {
    if (!server.identityFile) {
      throw new Error(`Server \"${server.name}\" is missing an identity file.`);
    }
    args.push("-i", server.identityFile, "-o", "IdentitiesOnly=yes");
  }
  if (server.authMode === "password") {
    args.push("-o", "PreferredAuthentications=password", "-o", "PubkeyAuthentication=no");
  }

  if (mode === "test" && server.authMode !== "password") {
    args.push("-o", "BatchMode=yes");
  }

  args.push(`${server.user}@${server.host}`);

  if (mode === "test") {
    args.push("echo 'Connection successful!'");
  }

  return args;
}

async function promptIdentityFilePath(name: string): Promise<{ identityFile: string; copied: boolean } | null> {
  const existingKeys = getExistingPrivateKeyFiles();
  let identityPath = "";
  let needsCopy = false;

  if (existingKeys.length > 0) {
    const keyChoices = [
      ...existingKeys.map((k) => ({ name: k, value: k })),
      { name: "Specify custom path...", value: "__custom__" },
    ];

    const choice = await select<string>("Select private key:", keyChoices);
    if (choice === "__custom__") {
      const customPath = await input({ message: "Path to private key file:" });
      if (!customPath.trim()) {
        logger.fail("Private key path is required");
        return null;
      }
      identityPath = customPath.replace(/^~/, process.env.HOME || "");
      needsCopy = true;
    } else {
      identityPath = join(homedir(), ".ssh", choice);
    }
  } else {
    const customPath = await input({ message: "Path to private key file:" });
    if (!customPath.trim()) {
      logger.fail("Private key path is required");
      return null;
    }
    identityPath = customPath.replace(/^~/, process.env.HOME || "");
    needsCopy = true;
  }

  if (!existsSync(identityPath)) {
    logger.fail(`Private key file not found: ${identityPath}`);
    return null;
  }

  if (!needsCopy) {
    return { identityFile: identityPath, copied: false };
  }

  const copiedPath = await copyIdentityToSsh(identityPath, name);
  return { identityFile: copiedPath, copied: true };
}

async function addServerFlow(): Promise<void> {
  logger.info("Add a new server");

  const name = await input({ message: "Server name (alias):" });
  if (!name.trim()) {
    logger.fail("Server name is required");
    return;
  }

  const host = await input({ message: "Host (IP or hostname):" });
  if (!host.trim()) {
    logger.fail("Host is required");
    return;
  }

  const portStr = await input({ message: "SSH Port:", default: "22" });
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    logger.fail("Invalid port number");
    return;
  }

  const user = await input({ message: "Username:" });
  if (!user.trim()) {
    logger.fail("Username is required");
    return;
  }

  const authChoice = await select<ServerAuthMode>("Authentication method:", [
    { name: "Private key file", value: "identity_file" },
    { name: "SSH agent/default SSH behavior", value: "ssh_agent" },
    { name: "Password (prompted at connect/test)", value: "password" },
  ]);

  try {
    let identityFile: string | undefined;
    if (authChoice === "identity_file") {
      const result = await promptIdentityFilePath(name.trim());
      if (!result) {
        return;
      }
      identityFile = result.identityFile;
      if (result.copied) {
        logger.info(`Private key copied to: ${identityFile}`);
      }
    }
    logger.start("Adding server...");

    const server: ServerConfig = {
      name: name.trim(),
      host: host.trim(),
      port,
      user: user.trim(),
      authMode: authChoice,
      identityFile,
      createdAt: new Date().toISOString(),
    };

    await addServer(server);
    await addToSshConfig(server);

    logger.succeed(`Server \"${name}\" added successfully!`);
    logger.info(`You can also connect via: ssh ${name}`);
  } catch (error) {
    logger.fail(`Failed to add server: ${error}`);
  }
}

async function listServersFlow(): Promise<void> {
  const servers = await loadServers();

  if (servers.length === 0) {
    logger.info("No servers configured. Use 'Add Server' to add one.");
    return;
  }

  logger.info("\nConfigured Servers:\n");
  console.log("-".repeat(86));
  console.log(
    `${"NAME".padEnd(15)} ${"HOST".padEnd(20)} ${"PORT".padEnd(6)} ${"USER".padEnd(15)} ${"AUTH".padEnd(14)}`
  );
  console.log("-".repeat(86));

  for (const server of servers) {
    console.log(
      `${server.name.padEnd(15)} ${server.host.padEnd(20)} ${String(server.port).padEnd(6)} ${server.user.padEnd(15)} ${server.authMode.padEnd(14)}`
    );
  }
  console.log("-".repeat(86));
}

async function manageServersFlow(): Promise<void> {
  const servers = await loadServers();

  if (servers.length === 0) {
    logger.info("No servers configured. Use 'Add Server' to add one.");
    return;
  }

  await listServersFlow();

  const serverChoices = [
    ...servers.map((server) => ({
      name: `${server.name} (${server.user}@${server.host}:${server.port})`,
      value: server.name,
    })),
    { name: "Back", value: "__back__" },
  ];

  const selectedName = await select<string>("Select a server:", serverChoices);
  if (!selectedName || selectedName === "__back__") return;

  const server = await getServer(selectedName);
  if (!server) {
    logger.fail(`Server \"${selectedName}\" not found`);
    return;
  }

  const actionChoices: SelectChoice<string>[] = [
    { name: "Connect", value: "connect" },
    { name: "Test Connection", value: "test" },
    { name: "Setup Passwordless Login", value: "bootstrap" },
    { name: "Edit", value: "edit" },
    { name: "Delete", value: "delete" },
    { name: "Back", value: "back" },
  ];

  const action = await select<string>(`Action for \"${server.name}\":`, actionChoices);
  if (!action || action === "back") return;

  switch (action) {
    case "connect":
      await connectServerFlow(server.name);
      break;
    case "test":
      await testConnectionFlow(server.name);
      break;
    case "edit":
      await editServerFlow(server.name);
      break;
    case "bootstrap":
      await bootstrapPasswordlessFlow(server.name);
      break;
    case "delete":
      await deleteServerFlow(server.name);
      break;
  }
}

async function bootstrapPasswordlessFlow(selectedName?: string): Promise<void> {
  const servers = await loadServers();
  if (servers.length === 0) {
    logger.fail("No servers configured.");
    return;
  }

  let resolvedName = selectedName;
  if (!resolvedName) {
    const serverNames = servers.map((s) => s.name);
    resolvedName = await select<string>("Select server to bootstrap:", serverNames);
  }

  const server = resolvedName ? await getServer(resolvedName) : null;
  if (!server) {
    logger.fail(`Server "${resolvedName}" not found`);
    return;
  }

  logger.info(`Bootstrapping passwordless SSH for ${server.user}@${server.host}`);
  if (server.authMode !== "password") {
    logger.warn(`Server "${server.name}" is currently "${server.authMode}". Continuing bootstrap anyway.`);
  }

  const keySource = await select<"new" | "existing" | "back">("Key source:", [
    { name: "Create new key pair", value: "new" },
    { name: "Use existing private key", value: "existing" },
    { name: "Back", value: "back" },
  ]);
  if (keySource === "back") return;

  try {
    let newKeyName: string | undefined;
    let existingKeyPath: string | undefined;
    let passphrase: string | undefined;

    if (keySource === "new") {
      const defaultName = `${server.name}_key`;
      const keyName = await input({
        message: "Key name (will be created in ~/.ssh):",
        default: defaultName,
      });
      if (!keyName.trim()) {
        logger.fail("Key name is required.");
        return;
      }
      newKeyName = keyName.trim();
      passphrase = await password({
        message: "Passphrase for new key (optional):",
        mask: "*",
      });
    } else {
      const keyPath = await input({ message: "Path to existing private key:" });
      if (!keyPath.trim()) {
        logger.fail("Private key path is required.");
        return;
      }
      existingKeyPath = keyPath.trim();
    }

    logger.start("Preparing key material...");
    const prepared = await prepareBootstrapKey(server, { newKeyName, existingKeyPath, passphrase });
    logger.succeed("Key material ready.");

    logger.start("Installing public key on remote server (password prompt expected)...");
    await installPublicKeyOnServer(server, prepared.publicKeyPath);
    logger.succeed("Public key installed on remote server.");

    let finalIdentityFile = prepared.privateKeyPath;
    if (!finalIdentityFile.startsWith(join(homedir(), ".ssh"))) {
      finalIdentityFile = await copyIdentityToSsh(finalIdentityFile, server.name);
      logger.info(`Private key copied to: ${finalIdentityFile}`);
    }

    const updatedServer: ServerConfig = {
      ...server,
      authMode: "identity_file",
      identityFile: finalIdentityFile,
    };
    await updateServer(server.name, updatedServer);
    await updateSshConfig(updatedServer);
    logger.succeed(`Server "${server.name}" updated to identity_file auth.`);

    const agentStatus = await ensureIdentityInAgent(finalIdentityFile, { interactive: true });
    if (agentStatus === "added") {
      logger.info(`Loaded key into ssh-agent: ${finalIdentityFile}`);
    } else if (agentStatus === "failed") {
      logger.warn(`Could not load key into ssh-agent automatically: ${finalIdentityFile}`);
    }

    logger.start("Verifying key-based login...");
    const ok = await verifyIdentityFileConnection(updatedServer, finalIdentityFile);
    if (ok) {
      logger.succeed(`Passwordless SSH is ready for "${server.name}".`);
    } else {
      logger.warn("Key-based verification failed. Try loading key into agent if passphrase-protected:");
      logger.info(`ssh-add ${finalIdentityFile}`);
    }
  } catch (error) {
    logger.fail(`Bootstrap failed: ${error}`);
  }
}

async function connectServerFlow(selectedName?: string): Promise<void> {
  const servers = await loadServers();

  if (servers.length === 0) {
    logger.fail("No servers configured. Use 'Add Server' to add one.");
    return;
  }

  let resolvedName = selectedName;
  if (!resolvedName) {
    const serverNames = servers.map((s) => s.name);
    resolvedName = await select<string>("Select server to connect:", serverNames);
  }

  const server = resolvedName ? await getServer(resolvedName) : null;
  if (!server) {
    logger.fail(`Server \"${resolvedName}\" not found`);
    return;
  }

  logger.succeed(`Connecting to ${server.name}...`);
  if (server.authMode === "password") {
    logger.info("Password auth selected. SSH may prompt you for password.");
  }
  if (server.authMode === "identity_file" && server.identityFile) {
    await ensureIdentityInAgent(server.identityFile, { interactive: true });
  }

  try {
    const code = await runCommand("ssh", buildSshArgs(server, "connect"));
    if (code !== 0) {
      logger.fail(`Connection to ${server.name} failed`);
    }
  } catch (error) {
    logger.fail(`Connection to ${server.name} failed: ${error}`);
  }
}

async function editServerFlow(selectedName?: string): Promise<void> {
  const servers = await loadServers();

  if (servers.length === 0) {
    logger.fail("No servers configured.");
    return;
  }

  let resolvedName = selectedName;
  if (!resolvedName) {
    const serverNames = servers.map((s) => s.name);
    resolvedName = await select<string>("Select server to edit:", serverNames);
  }

  const server = resolvedName ? await getServer(resolvedName) : null;
  if (!server) {
    logger.fail(`Server \"${resolvedName}\" not found`);
    return;
  }

  logger.info(`Editing server: ${server.name} (press Enter to keep current value)`);

  const host = await input({ message: `Host [${server.host}]:`, default: server.host });
  const portStr = await input({ message: `Port [${server.port}]:`, default: String(server.port) });
  const user = await input({ message: `User [${server.user}]:`, default: server.user });
  const authMode = await select<ServerAuthMode>("Authentication method:", [
    { name: "Private key file", value: "identity_file" },
    { name: "SSH agent/default SSH behavior", value: "ssh_agent" },
    { name: "Password (prompted at connect/test)", value: "password" },
  ]);

  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    logger.fail("Invalid port number");
    return;
  }

  try {
    let identityFile: string | undefined;
    if (authMode === "identity_file") {
      const result = await promptIdentityFilePath(server.name);
      if (!result) {
        return;
      }
      identityFile = result.identityFile;
      if (result.copied) {
        logger.info(`Private key copied to: ${identityFile}`);
      }
    }
    logger.start("Updating server...");

    const updatedServer: ServerConfig = {
      ...server,
      host,
      port,
      user,
      authMode,
      identityFile,
    };

    await updateServer(server.name, updatedServer);
    await updateSshConfig(updatedServer);

    logger.succeed(`Server \"${server.name}\" updated successfully!`);
  } catch (error) {
    logger.fail(`Failed to update server: ${error}`);
  }
}

async function deleteServerFlow(selectedName?: string): Promise<void> {
  const servers = await loadServers();

  if (servers.length === 0) {
    logger.fail("No servers configured.");
    return;
  }

  let resolvedName = selectedName;
  if (!resolvedName) {
    const serverNames = servers.map((s) => s.name);
    resolvedName = await select<string>("Select server to delete:", serverNames);
  }

  const confirm = await select<"Yes" | "No">(`Delete server \"${resolvedName}\"?`, ["Yes", "No"]);

  if (confirm !== "Yes") {
    logger.info("Cancelled.");
    return;
  }

  try {
    logger.start("Deleting server...");
    if (!resolvedName) {
      logger.fail("No server selected.");
      return;
    }
    await deleteServer(resolvedName);
    await removeFromSshConfig(resolvedName);
    logger.succeed(`Server \"${resolvedName}\" deleted successfully!`);
  } catch (error) {
    logger.fail(`Failed to delete server: ${error}`);
  }
}

async function testConnectionFlow(selectedName?: string): Promise<void> {
  const servers = await loadServers();

  if (servers.length === 0) {
    logger.fail("No servers configured.");
    return;
  }

  let resolvedName = selectedName;
  if (!resolvedName) {
    const serverNames = servers.map((s) => s.name);
    resolvedName = await select<string>("Select server to test:", serverNames);
  }

  const server = resolvedName ? await getServer(resolvedName) : null;
  if (!server) {
    logger.fail(`Server \"${resolvedName}\" not found`);
    return;
  }

  logger.start(`Testing connection to ${server.name}...`);
  if (server.authMode === "password") {
    logger.info("Password auth selected. SSH may prompt you for password.");
  }
  if (server.authMode === "identity_file" && server.identityFile) {
    await ensureIdentityInAgent(server.identityFile, { interactive: true });
  }

  try {
    const code = await runCommand("ssh", buildSshArgs(server, "test"));

    if (code === 0) {
      logger.succeed(`Connection to ${server.name} successful!`);
    } else {
      logger.fail(`Connection to ${server.name} failed`);
    }
  } catch {
    logger.fail(`Connection to ${server.name} failed`);
  }
}

export async function serversCommand(): Promise<void> {
  const menuChoices: SelectChoice<ServerAction>[] = [
    { name: "Add Server", value: "add" },
    { name: "Manage Servers", value: "manage" },
    { name: "Back", value: "back" },
  ];

  const action = await select<ServerAction>("Server Management:", menuChoices);

  switch (action) {
    case "add":
      await addServerFlow();
      break;
    case "manage":
      await manageServersFlow();
      break;
    case "back":
      return;
  }
}
