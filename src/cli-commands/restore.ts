import { Command } from "commander";
import restoreCommand from "../commands/restore.ts";

export function registerRestoreCommand(program: Command) {
  program
    .command("restore")
    .description("Restores SSH files from a backup archive into ~/.ssh")
    .option("-a, --archive <path>", "Path to backup archive (.tar.gz or .gpg)")
    .option("-p, --passphrase <passphrase>", "Passphrase for encrypted .gpg backup")
    .option("--dry-run", "Validate and preview files without restoring")
    .option("--only <files>", "Comma-separated basenames to restore (e.g., config,id_ed25519)")
    .option("-f, --force", "Overwrite existing files in ~/.ssh")
    .addHelpText(
      "after",
      "\nExamples:\n  sship restore --dry-run\n  sship restore --only config,id_ed25519\n  sship restore --archive ~/sship_backup.tar.gz --force\n"
    )
    .action(async (options) => {
      await restoreCommand(options);
    });
}
