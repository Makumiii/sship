#!/usr/bin/env node
import { Command } from "commander";
import { registerCreateCommand } from "./cli-commands/create.ts";
import { registerDeleteCommand } from "./cli-commands/delete.ts";
import { registerListCommand } from "./cli-commands/list.ts";
import { registerBackupCommand } from "./cli-commands/backup.ts";
import { registerUninstallCommand } from "./cli-commands/uninstall.ts";
import { registerConnectCommand } from "./cli-commands/connect.ts";
import { registerDoctorCommand } from "./cli-commands/doctor.ts";
import { registerServersCommand } from "./cli-commands/servers.ts";
import { readFileSync } from "fs";
import { join } from "path";

// Interactive mode imports
import { logger } from "./utils/logger.ts";
import { select, type SelectChoice } from "./utils/select.ts";
import { ExitPromptError } from "@inquirer/core";
import deleteCommand from "./commands/deleteKey.ts";
import type { Tasks } from "./types.ts";
import createKeyCommand from "./commands/createKey.ts";
import listKeysCommand from "./commands/listKeys.ts";
import { runCommand } from "./utils/command.ts";
import backupCommand from "./commands/backup.ts";
import { connectCommand } from "./commands/connect.ts";
import doctorCommand from "./commands/doctor.ts";
import onboardCommand from "./commands/onboard.ts";
import { serversCommand } from "./commands/servers.ts";

const packageJson = JSON.parse(
    readFileSync(join(import.meta.dirname, "../package.json"), "utf-8")
);

// Check if arguments were passed (beyond just the node and script path)
const hasArgs = process.argv.length > 2;

if (hasArgs) {
    // CLI mode - use commander
    const program = new Command();

    program
        .name("sship")
        .description("SSH key management made simple")
        .version(packageJson.version);

    registerCreateCommand(program);
    registerDeleteCommand(program);
    registerListCommand(program);
    registerBackupCommand(program);
    registerUninstallCommand(program);
    registerConnectCommand(program);
    registerDoctorCommand(program);
    registerServersCommand(program);

    program.parse(process.argv);
} else {
    // Interactive mode - show menu
    const menuChoices: SelectChoice<Tasks>[] = [
        { name: "🔑  Create SSH Key", value: "create" },
        { name: "🗑️   Delete SSH Key", value: "delete" },
        { name: "📋  List SSH Keys", value: "list" },
        { name: "💾  Backup Keys", value: "backup" },
        { name: "🔗  Connect (SSH Config)", value: "connect" },
        { name: "🖥️   Server Connections (PEM)", value: "servers" },
        { name: "🚀  Onboard Keys", value: "onboard" },
        { name: "🩺  Run Doctor", value: "doctor" },
        { name: "🗑️   Uninstall SSHIP", value: "uninstall" },
        { name: "🚪  Exit", value: "exit" },
    ];

    try {
        const chosenTask = await select<Tasks>("What do you want to do?", menuChoices);

        switch (chosenTask) {
            case "create": {
                await createKeyCommand();
                break;
            }
            case "delete": {
                await deleteCommand();
                break;
            }
            case "list": {
                listKeysCommand();
                break;
            }
            case "backup": {
                await backupCommand();
                break;
            }
            case "uninstall": {
                const uninstallPath = join(import.meta.dirname, "../scripts/uninstall.sh");
                await runCommand(uninstallPath);
                break;
            }
            case "connect": {
                await connectCommand();
                break;
            }
            case "doctor": {
                await doctorCommand();
                break;
            }
            case "onboard": {
                await onboardCommand();
                break;
            }
            case "servers": {
                await serversCommand();
                break;
            }
            case "exit": {
                logger.info("Goodbye! 👋");
                process.exit(0);
            }
        }
    } catch (error) {
        if (error instanceof ExitPromptError) {
            logger.info("\n[SSHIP] Aborted. Exiting gracefully.");
            process.exit(130);
        } else {
            logger.fail(`[SSHIP] An unexpected error occurred: ${error}`);
        }
    }

    process.on("SIGINT", () => {
        logger.info("\n[SSHIP] SIGINT received. Exiting gracefully.");
        process.exit(130);
    });
}
