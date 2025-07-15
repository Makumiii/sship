import { Command } from 'commander';
import { runCommand } from '../utils/command.ts';
import { resolve } from 'path';

export function registerUninstallCommand(program: Command) {
  program.command('uninstall')
    .description('Removes the SSHIP application directory and symbolic link.')
    .action(async () => {
      const uninstallScriptPath = resolve(__dirname, '..', 'scripts', 'uninstall.sh');
      await runCommand(uninstallScriptPath);
    });
}
