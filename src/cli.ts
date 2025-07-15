import { Command } from 'commander';
import createKeyCommand from './commands/createKey.ts';
import deleteCommand from './commands/deleteKey.ts';
import listKeysCommand from './commands/listKeys.ts';
import backupCommand from './commands/backup.ts';
import { runNested } from './utils/nestedNav.ts';
import profileSequence from './utils/manageProfiles.ts';
import { connectCommand } from './commands/connect.ts';
import { runCommand } from './utils/command.ts';
import { resolve } from 'path';

const program = new Command();

program
  .name('sship')
  .description('CLI for SSH key management')
  .version('1.0.0');

program.command('create')
  .description('Guides you through the process of generating new SSH key pairs.')
  .action(async () => {
    await createKeyCommand();
  });

program.command('delete')
  .description('Lists all detected SSH key pairs and allows you to select one to delete.')
  .action(async () => {
    await deleteCommand();
  });

program.command('list')
  .description('Scans your ~/.ssh/ directory for SSH key files and presents a clean list.')
  .action(() => {
    listKeysCommand();
  });

program.command('backup')
  .description('Creates a secure backup of your SSH keys and configuration files.')
  .action(async () => {
    await backupCommand();
  });

program.command('uninstall')
  .description('Removes the SSHIP application directory and symbolic link.')
  .action(async () => {
    const uninstallScriptPath = resolve(__dirname, '..', 'scripts', 'uninstall.sh');
    await runCommand(uninstallScriptPath);
  });

program.command('manage-profiles')
  .description('Manage SSH connection profiles.')
  .action(async () => {
    await runNested(profileSequence);
  });

program.command('connect')
  .description('Connect to an SSH host using an alias from your config.')
  .action(async () => {
    await connectCommand();
  });

program.parse(process.argv);