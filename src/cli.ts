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

// ... (rest of the code)

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
