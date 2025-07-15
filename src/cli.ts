import { Command } from 'commander';
import { registerCreateCommand } from './cli-commands/create.ts';
import { registerDeleteCommand } from './cli-commands/delete.ts';
import { registerListCommand } from './cli-commands/list.ts';
import { registerBackupCommand } from './cli-commands/backup.ts';
import { registerUninstallCommand } from './cli-commands/uninstall.ts';
import { registerManageProfilesCommand } from './cli-commands/manage-profiles.ts';
import { registerConnectCommand } from './cli-commands/connect.ts';

const program = new Command();

program
  .name('sship')
  .description('CLI for SSH key management')
  .version('1.0.0');

registerCreateCommand(program);
registerDeleteCommand(program);
registerListCommand(program);
registerBackupCommand(program);
registerUninstallCommand(program);
registerManageProfilesCommand(program);
registerConnectCommand(program);

program.parse(process.argv);
