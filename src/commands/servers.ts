import { input } from "@inquirer/prompts";
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
    copyPemToSsh,
} from "../utils/serverStorage.ts";
import {
    addToSshConfig,
    removeFromSshConfig,
    updateSshConfig,
} from "../utils/sshConfig.ts";
import type { ServerConfig } from "../types/serverTypes.ts";
import type { SelectChoice } from "../utils/select.ts";

type ServerAction = "add" | "manage" | "back";

function getExistingPemFiles(): string[] {
    const sshDir = join(homedir(), ".ssh");
    if (!existsSync(sshDir)) {
        return [];
    }
    try {
        const files = readdirSync(sshDir);
        return files.filter((f) => f.endsWith(".pem"));
    } catch {
        return [];
    }
}

async function addServerFlow(): Promise<void> {
    logger.info("Add a new server");

    // Check for existing PEM files
    const existingPems = getExistingPemFiles();
    let pemPath: string;
    let needsCopy = false;

    if (existingPems.length > 0) {
        const pemChoices = [
            ...existingPems.map((p) => ({ name: p, value: p })),
            { name: "Specify custom path...", value: "__custom__" },
        ];

        const pemChoice = await select<string>("Select PEM key:", pemChoices);

        if (pemChoice === "__custom__") {
            const customPath = await input({ message: "Path to PEM key file:" });
            if (!customPath.trim()) {
                logger.fail("PEM key path is required");
                return;
            }
            pemPath = customPath.replace(/^~/, process.env.HOME || "");
            needsCopy = true;
        } else {
            pemPath = join(homedir(), ".ssh", pemChoice);
            needsCopy = false;
        }
    } else {
        const customPath = await input({ message: "Path to PEM key file:" });
        if (!customPath.trim()) {
            logger.fail("PEM key path is required");
            return;
        }
        pemPath = customPath.replace(/^~/, process.env.HOME || "");
        needsCopy = true;
    }

    if (!existsSync(pemPath)) {
        logger.fail(`PEM file not found: ${pemPath}`);
        return;
    }

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

    try {
        logger.start("Adding server...");

        let finalPemPath = pemPath;

        // Only copy if user specified external path
        if (needsCopy) {
            finalPemPath = await copyPemToSsh(pemPath, name);
            logger.info(`PEM key copied to: ${finalPemPath}`);
        }

        const server: ServerConfig = {
            name: name.trim(),
            host: host.trim(),
            port,
            user: user.trim(),
            pemKeyPath: finalPemPath,
            createdAt: new Date().toISOString(),
        };

        // Save to sship config
        await addServer(server);

        // Add to ~/.ssh/config
        await addToSshConfig(server);

        logger.succeed(`Server "${name}" added successfully!`);
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
    console.log("-".repeat(70));
    console.log(
        `${"NAME".padEnd(15)} ${"HOST".padEnd(20)} ${"PORT".padEnd(6)} ${"USER".padEnd(15)}`
    );
    console.log("-".repeat(70));

    for (const server of servers) {
        console.log(
            `${server.name.padEnd(15)} ${server.host.padEnd(20)} ${String(server.port).padEnd(6)} ${server.user.padEnd(15)}`
        );
    }
    console.log("-".repeat(70));
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
        logger.fail(`Server "${selectedName}" not found`);
        return;
    }

    const actionChoices: SelectChoice<string>[] = [
        { name: "Connect", value: "connect" },
        { name: "Test Connection", value: "test" },
        { name: "Edit", value: "edit" },
        { name: "Delete", value: "delete" },
        { name: "Back", value: "back" },
    ];

    const action = await select<string>(`Action for "${server.name}":`, actionChoices);
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
        case "delete":
            await deleteServerFlow(server.name);
            break;
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
        logger.fail(`Server "${resolvedName}" not found`);
        return;
    }

    // Stop any spinner before SSH - TTY needs clean terminal
    logger.succeed(`Connecting to ${server.name}...`);

    // Use IdentitiesOnly to avoid SSH agent trying all keys
    const code = await runCommand("ssh", [
        "-i", server.pemKeyPath,
        "-p", String(server.port),
        "-o", "IdentitiesOnly=yes",
        `${server.user}@${server.host}`,
    ]);

    if (code !== 0) {
        logger.fail(`Connection to ${server.name} failed`);
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
        logger.fail(`Server "${resolvedName}" not found`);
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

    const confirm = await select<"Yes" | "No">(
        `Delete server "${resolvedName}"?`,
        ["Yes", "No"]
    );

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
        logger.succeed(`Server "${resolvedName}" deleted successfully!`);
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
        logger.fail(`Server "${resolvedName}" not found`);
        return;
    }

    logger.start(`Testing connection to ${server.name}...`);

    try {
        const code = await runCommand("ssh", [
            "-i", server.pemKeyPath,
            "-p", String(server.port),
            "-o", "IdentitiesOnly=yes",
            "-o", "ConnectTimeout=10",
            "-o", "BatchMode=yes",
            `${server.user}@${server.host}`,
            "echo 'Connection successful!'",
        ]);

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
