import { Command } from 'commander';
import { runCommand } from '../utils/command.ts';
import { resolve } from 'path';
import { isWindows } from '../utils/osDetect.ts';

export function registerUninstallCommand(program: Command) {
  program.command('uninstall')
    .description('Removes the SSHIP application directory and symbolic link.')
    .action(async () => {
      const scriptExtension = isWindows() ? '.ps1' : '.sh';
      const scriptDir = isWindows() ? '../scripts/powershell' : '../scripts/bash';
      const uninstallScriptPath = resolve(__dirname, scriptDir, `uninstall${scriptExtension}`);
      
      if (isWindows()) {
        await runCommand('powershell.exe', ['-File', uninstallScriptPath]);
      } else {
        await runCommand(uninstallScriptPath);
      }
    });
}
