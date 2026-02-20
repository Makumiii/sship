import { Command } from "commander";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { serversCommand } from "../commands/servers.ts";
import { logger } from "../utils/logger.ts";
import {
  addServer,
  copyIdentityToSsh,
  deleteServer,
  getServer,
  loadServers,
} from "../utils/serverStorage.ts";
import { addToSshConfig, removeFromSshConfig } from "../utils/sshConfig.ts";
import type { ServerAuthMode, ServerConfig } from "../types/serverTypes.ts";

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

export function registerServersCommand(program: Command) {
  const servers = program
    .command("servers")
    .description("Manage server connections")
    .addHelpText(
      "after",
      "\nExamples:\n  sship servers list\n  sship servers add -n prod -H 10.0.0.10 -u ubuntu --auth identity_file -k ~/.ssh/prod_key\n  sship servers add -n homelab -H 192.168.100.189 -u maks --auth ssh_agent\n  sship servers add -n homelab-pass -H 192.168.100.189 -u maks --auth password\n  sship servers test prod\n  sship servers delete prod --yes\n"
    );

  servers.action(async () => {
    await serversCommand();
  });

  servers
    .command("list")
    .description("List configured servers")
    .action(async () => {
      const entries = await loadServers();
      if (entries.length === 0) {
        logger.info("No servers configured. Use 'sship servers add' to add one.");
        return;
      }
      logger.info("Configured servers:\n");
      console.log("-".repeat(86));
      console.log(
        `${"NAME".padEnd(15)} ${"HOST".padEnd(20)} ${"PORT".padEnd(6)} ${"USER".padEnd(15)} ${"AUTH".padEnd(14)}`
      );
      console.log("-".repeat(86));
      for (const server of entries) {
        console.log(
          `${server.name.padEnd(15)} ${server.host.padEnd(20)} ${String(server.port).padEnd(6)} ${server.user.padEnd(15)} ${server.authMode.padEnd(14)}`
        );
      }
      console.log("-".repeat(86));
    });

  servers
    .command("add")
    .description("Add a server non-interactively")
    .requiredOption("-n, --name <name>", "Server alias")
    .requiredOption("-H, --host <host>", "Host IP/domain")
    .option("-p, --port <port>", "SSH port", "22")
    .requiredOption("-u, --user <user>", "SSH username")
    .option("-a, --auth <mode>", "Auth mode: identity_file, ssh_agent, or password", "identity_file")
    .option("-k, --key <path>", "Path to private key file (required when --auth identity_file)")
    .option("--no-copy", "Use key path as-is (do not copy into ~/.ssh)")
    .action(async (options: {
      name: string;
      host: string;
      port: string;
      user: string;
      auth: string;
      key?: string;
      copy: boolean;
    }) => {
      const port = Number.parseInt(options.port, 10);
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        logger.fail("Invalid port number");
        return;
      }

      const authMode = options.auth.trim() as ServerAuthMode;
      if (authMode !== "identity_file" && authMode !== "ssh_agent" && authMode !== "password") {
        logger.fail("Invalid auth mode. Use identity_file, ssh_agent, or password.");
        return;
      }

      let identityFile: string | undefined;
      if (authMode === "identity_file") {
        if (!options.key) {
          logger.fail("--key is required when --auth identity_file");
          return;
        }
        const expandedKey = options.key.replace(/^~/, process.env.HOME || "");
        if (!existsSync(expandedKey)) {
          logger.fail(`Private key file not found: ${expandedKey}`);
          return;
        }

        identityFile = expandedKey;
        if (options.copy) {
          identityFile = await copyIdentityToSsh(expandedKey, options.name);
          logger.info(`Private key copied to: ${identityFile}`);
        }
      }

      try {
        const server: ServerConfig = {
          name: options.name.trim(),
          host: options.host.trim(),
          port,
          user: options.user.trim(),
          authMode,
          identityFile,
          createdAt: new Date().toISOString(),
        };

        await addServer(server);
        await addToSshConfig(server);
        logger.succeed(`Server \"${server.name}\" added successfully!`);
      } catch (error) {
        logger.fail(`Failed to add server: ${error}`);
      }
    });

  servers
    .command("delete <name>")
    .description("Delete a configured server")
    .option("-y, --yes", "Confirm deletion without prompt")
    .action(async (name: string, options: { yes?: boolean }) => {
      if (!options.yes) {
        logger.fail("Pass --yes to confirm deletion in CLI mode.");
        return;
      }
      try {
        await deleteServer(name);
        await removeFromSshConfig(name);
        logger.succeed(`Server \"${name}\" deleted successfully!`);
      } catch (error) {
        logger.fail(`Failed to delete server: ${error}`);
      }
    });

  servers
    .command("test <name>")
    .description("Test SSH connectivity for a server alias")
    .action(async (name: string) => {
      const server = await getServer(name);
      if (!server) {
        logger.fail(`Server \"${name}\" not found`);
        return;
      }

      logger.start(`Testing connection to ${server.name}...`);
      if (server.authMode === "password") {
        logger.info("Password auth selected. SSH may prompt you for password.");
      }
      let args: string[];
      try {
        args = buildSshArgs(server, "test");
      } catch (error) {
        logger.fail(String(error));
        return;
      }

      const result = await new Promise<number>((resolve) => {
        const child = spawn("ssh", args, { stdio: "inherit" });
        child.on("close", (code) => resolve(code ?? 1));
        child.on("error", () => resolve(1));
      });

      if (result === 0) {
        logger.succeed(`Connection to ${server.name} successful!`);
      } else {
        logger.fail(`Connection to ${server.name} failed`);
      }
    });

  servers
    .command("connect <name>")
    .description("Open SSH connection to a configured server")
    .action(async (name: string) => {
      const server = await getServer(name);
      if (!server) {
        logger.fail(`Server \"${name}\" not found`);
        return;
      }

      let args: string[];
      try {
        args = buildSshArgs(server, "connect");
      } catch (error) {
        logger.fail(String(error));
        return;
      }

      const code = await new Promise<number>((resolve) => {
        if (server.authMode === "password") {
          logger.info("Password auth selected. SSH may prompt you for password.");
        }
        const child = spawn("ssh", args, { stdio: "inherit" });
        child.on("close", (exitCode) => resolve(exitCode ?? 1));
        child.on("error", () => resolve(1));
      });
      if (code !== 0) {
        logger.fail(`Connection to ${server.name} failed`);
      }
    });
}
