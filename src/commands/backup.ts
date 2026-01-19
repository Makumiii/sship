import { logger } from "../utils/logger.ts";
import { promptUser } from "../utils/prompt";
import { homedir } from "node:os";
import { readdir, copyFile, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { runCommand } from "../utils/command";
import { basename, join } from "path";

const location = `${homedir()}/.ssh`;

export default async function backupCommand(options?: { passphrase?: string }) {
    let passphrase = options?.passphrase;
    if (!passphrase) {
        const encryptionKey = await promptUser([{ id: "passphrase", message: "Enter a passphrase for encryption (leave blank to skip):" }]);
        passphrase = encryptionKey.passphrase;
    }

    // Create temp directory inside function, not at module load
    const tempDirLocation = tmpdir();
    const privTempDir = await mkdtemp(`${tempDirLocation}/sship-backup-`);

    const backupTerms = ["id", "config", "known_hosts", "authorized_keys", ".pem", ".pub"];
    logger.start(`Reading SSH directory: ${location}`);
    const items = await readdir(location, { withFileTypes: true });
    const files = items
        .filter((item) => item.isFile)
        .map((item) => item.name)
        .filter((file) => backupTerms.some((term) => file.includes(term)));

    if (files.length === 0) {
        logger.succeed("No files found matching backup terms.");
        return;
    }

    logger.succeed(`Found files to backup: ${files.join(", ")}`);
    const filesWithPath = files.map((file) => `${location}/${file}`);

    for (const singleFileWithPath of filesWithPath) {
        const destPath = `${privTempDir}/${basename(singleFileWithPath)}`;
        logger.start(`Copying ${singleFileWithPath} to ${destPath}`);
        await copyFile(singleFileWithPath, destPath);
    }

    const pathToScript = join(import.meta.dirname, "../../scripts/commands/backup.sh");
    const args = [privTempDir, passphrase || ""];

    await runCommand(pathToScript, args);
    logger.succeed("Backup process completed.");
}