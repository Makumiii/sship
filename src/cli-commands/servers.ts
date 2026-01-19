import { Command } from 'commander';
import { serversCommand } from '../commands/servers.ts';

export function registerServersCommand(program: Command) {
    program.command('servers')
        .description('Manage PEM key server connections')
        .action(async () => {
            await serversCommand();
        });
}
