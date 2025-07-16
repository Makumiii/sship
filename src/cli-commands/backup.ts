import { Command } from 'commander';
import backupCommand from '../commands/backup.ts';

export function registerBackupCommand(program: Command) {
  program.command('backup')
    .description('Creates a secure backup of your SSH keys and configuration files.')
    .option('-p, --passphrase <passphrase>', 'Passphrase for encrypting the backup archive')
    .action(async (options) => {
      await backupCommand(options);
    });
}
