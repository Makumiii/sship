import { Command } from 'commander';
import listKeysCommand from '../commands/listKeys.ts';

export function registerListCommand(program: Command) {
  program.command('list')
    .description('Scans your ~/.ssh/ directory for SSH key files and presents a clean list.')
    .action(() => {
      listKeysCommand();
    });
}
