import { Command } from 'commander';
import { connectCommand } from '../commands/connect.ts';

export function registerConnectCommand(program: Command) {
  program.command('connect')
    .description('Connect to an SSH host using an alias from your config.')
    .argument('[alias]', 'SSH alias to connect to')
    .action(async (alias) => {
      await connectCommand(alias);
    });
}
