import { Command } from "commander";
import {
    tunnelCommand,
    listTunnels,
    startTunnel,
    stopTunnel,
    createTunnelWizard,
    discoverTunnelWizard,
} from "../commands/tunnel.ts";
import { getTunnel, loadTunnels, clearDeadPids } from "../utils/tunnelStorage.ts";
import { logger } from "../utils/logger.ts";

export function registerTunnelCommand(program: Command) {
    const tunnel = program
        .command("tunnel")
        .description("Manage SSH tunnels for port forwarding");

    // Default action - interactive mode
    tunnel.action(async () => {
        await tunnelCommand();
    });

    // List tunnels
    tunnel
        .command("list")
        .description("List all configured tunnels")
        .action(async () => {
            await listTunnels();
        });

    // Start a tunnel
    tunnel
        .command("start <name>")
        .description("Start a saved tunnel by name")
        .action(async (name: string) => {
            await clearDeadPids();
            const tunnelConfig = await getTunnel(name);
            if (!tunnelConfig) {
                logger.fail(`Tunnel "${name}" not found`);
                return;
            }

            if (tunnelConfig.pid) {
                try {
                    process.kill(tunnelConfig.pid, 0);
                    logger.info(`Tunnel "${name}" is already running (PID: ${tunnelConfig.pid})`);
                    return;
                } catch {
                    // Process is dead, continue to start
                }
            }

            logger.start(`Starting tunnel "${name}"...`);
            const pid = await startTunnel(tunnelConfig);
            if (pid) {
                logger.succeed(`Tunnel "${name}" started! (PID: ${pid})`);
            } else {
                logger.fail(`Failed to start tunnel "${name}"`);
            }
        });

    // Stop a tunnel
    tunnel
        .command("stop <name>")
        .description("Stop a running tunnel by name")
        .action(async (name: string) => {
            const stopped = await stopTunnel(name);
            if (stopped) {
                logger.succeed(`Tunnel "${name}" stopped`);
            }
        });

    // Create a new tunnel (interactive)
    tunnel
        .command("create")
        .description("Create a new tunnel interactively")
        .action(async () => {
            await createTunnelWizard();
        });

    // Discover and bind a remote port (interactive)
    tunnel
        .command("discover")
        .description("Discover remote listening ports and bind one locally")
        .action(async () => {
            await discoverTunnelWizard();
        });
}
