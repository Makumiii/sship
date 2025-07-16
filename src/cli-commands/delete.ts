import { Command } from 'commander';
import deleteCommand from '../commands/deleteKey.ts';

export function registerDeleteCommand(program: Command) {
  program.command('delete')
    .description('Lists all detected SSH key pairs and allows you to select one to delete.')
    .argument('[keyName]', 'Name of the key to delete')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (keyName, options) => {
      await deleteCommand(keyName, options.yes);
    });
}
