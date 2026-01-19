import { input } from "@inquirer/prompts";
import { existsSync } from "fs";
import { logger } from "../utils/logger.ts";
import { select } from "../utils/select.ts";
import { runCommand } from "../utils/command.ts";
import {
    loadServers,
    addServer,
    getServer,
    updateServer,
    deleteServer,
    copyPemToSsh,
} from "../utils/serverStorage.ts";
import {
    addToSshConfig,
    removeFromSshConfig,
    updateSshConfig,
} from "../utils/sshConfig.ts";
import type { ServerConfig } from "../types/serverTypes.ts";

type ServerAction = "add" | "list" | "connect" | "edit" | "delete" | "test" | "back";

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

    const pemPath = await input({ message: "Path to PEM key file:" });
    if (!pemPath.trim()) {
        logger.fail("PEM key path is required");
        return;
    }

    const expandedPath = pemPath.replace(/^~/, process.env.HOME || "");
    if (!existsSync(expandedPath)) {
        logger.fail(`PEM file not found: ${expandedPath}`);
        return;
    }

    try {
        logger.start("Adding server...");

        // Copy PEM to ~/.ssh/
        const sshPemPath = await copyPemToSsh(expandedPath, name);

        const server: ServerConfig = {
            name: name.trim(),
            host: host.trim(),
            port,
            user: user.trim(),
            pemKeyPath: sshPemPath,
            createdAt: new Date().toISOString(),
        };

        // Save to sship config
        await addServer(server);

        // Add to ~/.ssh/config
        await addToSshConfig(server);

        logger.succeed(`Server "${name}" added successfully!`);
        logger.info(`PEM key copied to: ${sshPemPath}`);
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

    logger.info("\n📋 Configured Servers:\n");
    console.log("─".repeat(70));
    console.log(
        `${"NAME".padEnd(15)} ${"HOST".padEnd(20)} ${"PORT".padEnd(6)} ${"USER".padEnd(15)}`
    );
    console.log("─".repeat(70));

    for (const server of servers) {
        console.log(
            `${server.name.padEnd(15)} ${server.host.padEnd(20)} ${String(server.port).padEnd(6)} ${server.user.padEnd(15)}`
        );
    }
    console.log("─".repeat(70));
}

async function connectServerFlow(): Promise<void> {
    const servers = await loadServers();

    if (servers.length === 0) {
        logger.fail("No servers configured. Use 'Add Server' to add one.");
        return;
    }

    const serverNames = servers.map((s) => s.name);
    const selectedName = await select<string>("Select server to connect:", serverNames);

    const server = await getServer(selectedName);
    if (!server) {
        logger.fail(`Server "${selectedName}" not found`);
        return;
    }

    logger.start(`Connecting to ${server.name}...`);

    // Use IdentitiesOnly to avoid SSH agent trying all keys
    await runCommand("ssh", [
        "-i", server.pemKeyPath,
        "-p", String(server.port),
        "-o", "IdentitiesOnly=yes",
        `${server.user}@${server.host}`,
    ]);
}

async function editServerFlow(): Promise<void> {
    const servers = await loadServers();

    if (servers.length === 0) {
        logger.fail("No servers configured.");
        return;
    }

    const serverNames = servers.map((s) => s.name);
    const selectedName = await select<string>("Select server to edit:", serverNames);

    const server = await getServer(selectedName);
    if (!server) {
        logger.fail(`Server "${selectedName}" not found`);
        return;
    }

    logger.info(`Editing server: ${server.name} (press Enter to keep current value)`);

    const host = await input({ message: `Host [${server.host}]:`, default: server.host });
    const portStr = await input({ message: `Port [${server.port}]:`, default: String(server.port) });
    const user = await input({ message: `User [${server.user}]:`, default: server.user });
    const pemPath = await input({
        message: `PEM path [${server.pemKeyPath}]:`,
        default: server.pemKeyPath
    });

    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        logger.fail("Invalid port number");
        return;
    }

    try {
        logger.start("Updating server...");

        let finalPemPath = server.pemKeyPath;

        // If PEM path changed, copy new key
        if (pemPath !== server.pemKeyPath && !pemPath.includes("/.ssh/")) {
            const expandedPath = pemPath.replace(/^~/, process.env.HOME || "");
            if (existsSync(expandedPath)) {
                finalPemPath = await copyPemToSsh(expandedPath, server.name);
            }
        }

        const updatedServer: ServerConfig = {
            ...server,
            host,
            port,
            user,
            pemKeyPath: finalPemPath,
        };

        await updateServer(server.name, updatedServer);
        await updateSshConfig(updatedServer);

        logger.succeed(`Server "${server.name}" updated successfully!`);
    } catch (error) {
        logger.fail(`Failed to update server: ${error}`);
    }
}

async function deleteServerFlow(): Promise<void> {
    const servers = await loadServers();

    if (servers.length === 0) {
        logger.fail("No servers configured.");
        return;
    }

    const serverNames = servers.map((s) => s.name);
    const selectedName = await select<string>("Select server to delete:", serverNames);

    const confirm = await select<"Yes" | "No">(
        `Delete server "${selectedName}"?`,
        ["Yes", "No"]
    );

    if (confirm !== "Yes") {
        logger.info("Cancelled.");
        return;
    }

    try {
        logger.start("Deleting server...");
        await deleteServer(selectedName);
        await removeFromSshConfig(selectedName);
        logger.succeed(`Server "${selectedName}" deleted successfully!`);
    } catch (error) {
        logger.fail(`Failed to delete server: ${error}`);
    }
}

async function testConnectionFlow(): Promise<void> {
    const servers = await loadServers();

    if (servers.length === 0) {
        logger.fail("No servers configured.");
        return;
    }

    const serverNames = servers.map((s) => s.name);
    const selectedName = await select<string>("Select server to test:", serverNames);

    const server = await getServer(selectedName);
    if (!server) {
        logger.fail(`Server "${selectedName}" not found`);
        return;
    }

    logger.start(`Testing connection to ${server.name}...`);

    try {
        await runCommand("ssh", [
            "-i", server.pemKeyPath,
            "-p", String(server.port),
            "-o", "IdentitiesOnly=yes",
            "-o", "ConnectTimeout=10",
            "-o", "BatchMode=yes",
            `${server.user}@${server.host}`,
            "echo 'Connection successful!'",
        ]);
        logger.succeed(`Connection to ${server.name} successful!`);
    } catch {
        logger.fail(`Connection to ${server.name} failed`);
    }
}

import type { SelectChoice } from "../utils/select.ts";

export async function serversCommand(): Promise<void> {
    const menuChoices: SelectChoice<ServerAction>[] = [
        { name: "➕  Add Server", value: "add" },
        { name: "📋  List Servers", value: "list" },
        { name: "🔗  Connect to Server", value: "connect" },
        { name: "✏️   Edit Server", value: "edit" },
        { name: "🗑️   Delete Server", value: "delete" },
        { name: "🧪  Test Connection", value: "test" },
        { name: "⬅️   Back", value: "back" },
    ];

    const action = await select<ServerAction>("Server Management:", menuChoices);

    switch (action) {
        case "add":
            await addServerFlow();
            break;
        case "list":
            await listServersFlow();
            break;
        case "connect":
            await connectServerFlow();
            break;
        case "edit":
            await editServerFlow();
            break;
        case "delete":
            await deleteServerFlow();
            break;
        case "test":
            await testConnectionFlow();
            break;
        case "back":
            return;
    }
}
