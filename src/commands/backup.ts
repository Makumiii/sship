import { logger } from "../utils/logger.ts";
import { promptUser } from "../utils/prompt";
import { homedir } from "node:os";
import { readdir, copyFile, mkdtemp } from "fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "os";
import { runCommand } from "../utils/command";
import { basename } from "path";
import { resolveScriptPath } from "../utils/scriptPath.ts";

const location = `${homedir()}/.ssh`;

export default async function backupCommand(options?: { passphrase?: string }) {
    const hasPassphraseOption = Boolean(options) &&
        Object.prototype.hasOwnProperty.call(options, "passphrase");
    let passphrase = options?.passphrase;
    if (!hasPassphraseOption) {
        const encryptionKey = await promptUser([{ id: "passphrase", message: "Enter a passphrase for encryption (leave blank to skip):" }]);
        passphrase = encryptionKey.passphrase;
    }

    // Create temp directory inside function, not at module load
    const tempDirLocation = tmpdir();
    const privTempDir = await mkdtemp(`${tempDirLocation}/sship-backup-`);

    if (!existsSync(location)) {
        logger.succeed("No files found in ~/.ssh to back up.");
        return;
    }

    logger.start(`Reading SSH directory: ${location}`);
    let items: Awaited<ReturnType<typeof readdir>>;
    try {
        items = await readdir(location, { withFileTypes: true });
    } catch (error) {
        const errno = error as NodeJS.ErrnoException;
        if (errno.code === "ENOENT") {
            logger.succeed("No files found in ~/.ssh to back up.");
            return;
        }
        throw error;
    }
    const files = items
        .filter((item) => item.isFile())
        .map((item) => item.name);

    if (files.length === 0) {
        logger.succeed("No files found in ~/.ssh to back up.");
        return;
    }

    logger.succeed(`Found files to backup: ${files.join(", ")}`);
    const filesWithPath = files.map((file) => `${location}/${file}`);

    for (const singleFileWithPath of filesWithPath) {
        const destPath = `${privTempDir}/${basename(singleFileWithPath)}`;
        logger.start(`Copying ${singleFileWithPath} to ${destPath}`);
        await copyFile(singleFileWithPath, destPath);
    }

    const pathToScript = resolveScriptPath(import.meta.dirname, "commands/backup.sh");
    const args = [privTempDir, passphrase || ""];

    const code = await runCommand(pathToScript, args);
    if (code !== 0) {
        logger.fail("Backup process failed.");
        return;
    }
    logger.succeed("Backup process completed.");
}
