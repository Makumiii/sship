import { Command } from "commander";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { serversCommand } from "../commands/servers.ts";
import { logger } from "../utils/logger.ts";
import {
    addServer,
    copyPemToSsh,
    deleteServer,
    getServer,
    loadServers,
} from "../utils/serverStorage.ts";
import { addToSshConfig, removeFromSshConfig } from "../utils/sshConfig.ts";
import type { ServerConfig } from "../types/serverTypes.ts";

export function registerServersCommand(program: Command) {
    const servers = program
        .command("servers")
        .description("Manage PEM key server connections")
        .addHelpText(
            "after",
            "\nExamples:\n  sship servers list\n  sship servers add -n prod -H 10.0.0.10 -u ubuntu -k ~/.ssh/prod.pem\n  sship servers test prod\n  sship servers delete prod --yes\n"
        );

    servers.action(async () => {
        await serversCommand();
    });

    servers
        .command("list")
        .description("List configured PEM servers")
        .action(async () => {
            const entries = await loadServers();
            if (entries.length === 0) {
                logger.info("No servers configured. Use 'sship servers add' to add one.");
                return;
            }
            logger.info("Configured servers:\n");
            console.log("-".repeat(70));
            console.log(`${"NAME".padEnd(15)} ${"HOST".padEnd(20)} ${"PORT".padEnd(6)} ${"USER".padEnd(15)}`);
            console.log("-".repeat(70));
            for (const server of entries) {
                console.log(
                    `${server.name.padEnd(15)} ${server.host.padEnd(20)} ${String(server.port).padEnd(6)} ${server.user.padEnd(15)}`
                );
            }
            console.log("-".repeat(70));
        });

    servers
        .command("add")
        .description("Add a PEM server non-interactively")
        .requiredOption("-n, --name <name>", "Server alias")
        .requiredOption("-H, --host <host>", "Host IP/domain")
        .option("-p, --port <port>", "SSH port", "22")
        .requiredOption("-u, --user <user>", "SSH username")
        .requiredOption("-k, --pem <path>", "Path to PEM key file")
        .option("--no-copy", "Use PEM path as-is (do not copy into ~/.ssh)")
        .action(async (options: {
            name: string;
            host: string;
            port: string;
            user: string;
            pem: string;
            copy: boolean;
        }) => {
            const port = Number.parseInt(options.port, 10);
            if (!Number.isFinite(port) || port < 1 || port > 65535) {
                logger.fail("Invalid port number");
                return;
            }

            const expandedPem = options.pem.replace(/^~/, process.env.HOME || "");
            if (!existsSync(expandedPem)) {
                logger.fail(`PEM file not found: ${expandedPem}`);
                return;
            }

            try {
                let pemKeyPath = expandedPem;
                if (options.copy) {
                    pemKeyPath = await copyPemToSsh(expandedPem, options.name);
                    logger.info(`PEM key copied to: ${pemKeyPath}`);
                }

                const server: ServerConfig = {
                    name: options.name.trim(),
                    host: options.host.trim(),
                    port,
                    user: options.user.trim(),
                    pemKeyPath,
                    createdAt: new Date().toISOString(),
                };

                await addServer(server);
                await addToSshConfig(server);
                logger.succeed(`Server "${server.name}" added successfully!`);
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
                logger.succeed(`Server "${name}" deleted successfully!`);
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
                logger.fail(`Server "${name}" not found`);
                return;
            }

            logger.start(`Testing connection to ${server.name}...`);
            const args = [
                "-i", server.pemKeyPath,
                "-p", String(server.port),
                "-o", "IdentitiesOnly=yes",
                "-o", "ConnectTimeout=10",
                "-o", "BatchMode=yes",
                `${server.user}@${server.host}`,
                "echo 'Connection successful!'",
            ];

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
                logger.fail(`Server "${name}" not found`);
                return;
            }
            const args = [
                "-i", server.pemKeyPath,
                "-p", String(server.port),
                "-o", "IdentitiesOnly=yes",
                `${server.user}@${server.host}`,
            ];
            const code = await new Promise<number>((resolve) => {
                const child = spawn("ssh", args, { stdio: "inherit" });
                child.on("close", (exitCode) => resolve(exitCode ?? 1));
                child.on("error", () => resolve(1));
            });
            if (code !== 0) {
                logger.fail(`Connection to ${server.name} failed`);
            }
        });
}
