import { Command } from 'commander';
import createKeyCommand from '../commands/createKey.ts';

export function registerCreateCommand(program: Command) {
  program.command('create')
    .description('Guides you through the process of generating new SSH key pairs.')
    .option('-e, --email <email>', 'Email address for the SSH key comment')
    .option('-p, --passphrase <passphrase>', 'Passphrase for the SSH key')
    .option('-n, --name <name>', 'Name of the SSH key')
    .option('-H, --host <host>', 'Host associated with the SSH key (e.g., github.com)')
    .option('-u, --user <user>', 'Username for the host (e.g., git)')
    .option('-t, --template <template>', 'Service template (e.g., github, gitlab, bitbucket, azure-devops, codeberg, custom)')
    .option('--list-templates', 'List available service templates')
    .addHelpText(
      "after",
      "\nExamples:\n  sship create --template github -n github-key -e me@example.com\n  sship create --list-templates\n"
    )
    .action(async (options) => {
      await createKeyCommand(options);
    });
}
