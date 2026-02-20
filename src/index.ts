#!/usr/bin/env node
import { Command } from "commander";
import { registerCreateCommand } from "./cli-commands/create.ts";
import { registerDeleteCommand } from "./cli-commands/delete.ts";
import { registerListCommand } from "./cli-commands/list.ts";
import { registerBackupCommand } from "./cli-commands/backup.ts";
import { registerRestoreCommand } from "./cli-commands/restore.ts";
import { registerInitCommand } from "./cli-commands/init.ts";
import { registerLogsCommand } from "./cli-commands/logs.ts";
import { registerUninstallCommand } from "./cli-commands/uninstall.ts";
import { registerDoctorCommand } from "./cli-commands/doctor.ts";
import { registerServersCommand } from "./cli-commands/servers.ts";
import { registerTransferCommand } from "./cli-commands/transfer.ts";
import { registerTunnelCommand } from "./cli-commands/tunnel.ts";
import { registerOnboardCommand } from "./cli-commands/onboard.ts";
import { readFileSync } from "fs";
import { join } from "path";

// Interactive mode imports
import { logger } from "./utils/logger.ts";
import { select, type SelectChoice } from "./utils/select.ts";
import { ExitPromptError } from "@inquirer/core";
import type { Tasks } from "./types.ts";
import { runCommand } from "./utils/command.ts";
import backupCommand from "./commands/backup.ts";
import restoreCommand from "./commands/restore.ts";
import initCommand from "./commands/init.ts";
import logsCommand from "./commands/logs.ts";
import doctorCommand from "./commands/doctor.ts";
import onboardCommand from "./commands/onboard.ts";
import { serversCommand } from "./commands/servers.ts";
import { transferCommand } from "./commands/transfer.ts";
import { tunnelCommand } from "./commands/tunnel.ts";
import { manageServiceKeys } from "./commands/serviceKeys.ts";

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
    registerRestoreCommand(program);
    registerInitCommand(program);
    registerLogsCommand(program);
    registerUninstallCommand(program);
    registerDoctorCommand(program);
    registerOnboardCommand(program);
    registerServersCommand(program);
    registerTransferCommand(program);
    registerTunnelCommand(program);

    try {
        await program.parseAsync(process.argv);
    } catch (error) {
        if (error instanceof ExitPromptError) {
            logger.info("\n[SSHIP] Aborted. Exiting gracefully.");
            process.exit(130);
        }
        throw error;
    }
} else {
    // Interactive mode - show menu
    const menuChoices: SelectChoice<Tasks>[] = [
        { name: "Service Keys", value: "serviceKeys" },
        { name: "Server Connections (PEM)", value: "servers" },
        { name: "Transfer Files (Synergy)", value: "transfer" },
        { name: "Tunnel Manager", value: "tunnel" },
        { name: "Onboard Keys", value: "onboard" },
        { name: "Run Doctor", value: "doctor" },
        { name: "First Run Setup", value: "init" },
        { name: "Backup Keys", value: "backup" },
        { name: "Restore Keys", value: "restore" },
        { name: "View Logs", value: "logs" },
        { name: "Uninstall SSHIP", value: "uninstall" },
        { name: "Exit", value: "exit" },
    ];

    try {
        const chosenTask = await select<Tasks>("What do you want to do?", menuChoices);

        switch (chosenTask) {
            case "serviceKeys": {
                await manageServiceKeys();
                break;
            }
            case "backup": {
                await backupCommand();
                break;
            }
            case "restore": {
                await restoreCommand();
                break;
            }
            case "init": {
                await initCommand({ fix: true });
                break;
            }
            case "logs": {
                await logsCommand();
                break;
            }
            case "uninstall": {
                const uninstallPath = join(import.meta.dirname, "../scripts/uninstall.sh");
                await runCommand(uninstallPath);
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
            case "transfer": {
                await transferCommand();
                break;
            }
            case "tunnel": {
                await tunnelCommand();
                break;
            }
            case "exit": {
                logger.info("Goodbye!");
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
