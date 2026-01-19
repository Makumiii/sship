import { Command } from 'commander';
import { transferCommand } from '../commands/transfer.ts';

export function registerTransferCommand(program: Command) {
    program.command('transfer')
        .description('Open the web-based file transfer UI (Synergy)')
        .action(async () => {
            await transferCommand();
        });
}
