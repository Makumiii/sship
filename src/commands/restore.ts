import { promptUser } from "../utils/prompt.ts";
import { logger } from "../utils/logger.ts";
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readdir, rm, chmod, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, basename } from "node:path";

type RestoreOptions = {
  archive?: string;
  passphrase?: string;
  dryRun?: boolean;
  force?: boolean;
  only?: string;
};

const DEFAULT_ARCHIVE = join(homedir(), "sship_backup.tar.gz");
const DEFAULT_ENCRYPTED_ARCHIVE = `${DEFAULT_ARCHIVE}.gpg`;
const SSH_DIR = join(homedir(), ".ssh");

function resolveArchivePath(archive?: string): string | null {
  if (archive) return archive;
  if (existsSync(DEFAULT_ARCHIVE)) return DEFAULT_ARCHIVE;
  if (existsSync(DEFAULT_ENCRYPTED_ARCHIVE)) return DEFAULT_ENCRYPTED_ARCHIVE;
  return null;
}

function runCapture(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: `${stderr}\n${String(error)}` }));
  });
}

function validateArchiveEntries(entries: string[]): { valid: boolean; reason?: string; files: string[] } {
  const files: string[] = [];
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry) continue;

    const normalized = entry.replace(/^\.\/+/, "");
    if (!normalized) continue;
    if (normalized.includes("..") || normalized.startsWith("/")) {
      return { valid: false, reason: `Unsafe path in archive: ${entry}`, files: [] };
    }
    if (normalized.endsWith("/")) continue;

    const fileName = basename(normalized);
    files.push(fileName);
  }

  return { valid: true, files: [...new Set(files)] };
}

function parseOnlyFilter(rawOnly?: string): Set<string> | null {
  if (!rawOnly) return null;
  const names = rawOnly
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => basename(part));
  return new Set(names);
}

async function resolveTarPath(archivePath: string, passphrase?: string): Promise<{ tarPath: string; cleanupPath?: string } | null> {
  if (!archivePath.endsWith(".gpg")) {
    return { tarPath: archivePath };
  }

  let resolvedPassphrase = passphrase;
  if (!resolvedPassphrase && process.stdin.isTTY) {
    const response = await promptUser([
      { id: "passphrase", message: "Enter backup passphrase for decryption:" },
    ]);
    resolvedPassphrase = response.passphrase;
  }

  const decryptedTarPath = join(tmpdir(), `sship-restore-${Date.now()}.tar.gz`);
  const gpgArgs = resolvedPassphrase
    ? ["--batch", "--yes", "--pinentry-mode", "loopback", "--passphrase", resolvedPassphrase, "-o", decryptedTarPath, "-d", archivePath]
    : ["--batch", "--yes", "-o", decryptedTarPath, "-d", archivePath];

  const decryptResult = await runCapture("gpg", gpgArgs);
  if (decryptResult.code !== 0) {
    logger.fail("Failed to decrypt backup archive. Check passphrase and GPG availability.");
    if (decryptResult.stderr.trim()) {
      console.log(decryptResult.stderr.trim());
    }
    return null;
  }

  return { tarPath: decryptedTarPath, cleanupPath: decryptedTarPath };
}

export default async function restoreCommand(options?: RestoreOptions): Promise<void> {
  const archivePath = resolveArchivePath(options?.archive);
  if (!archivePath) {
    logger.fail("No backup archive found. Provide --archive or create a backup first.");
    return;
  }
  if (!existsSync(archivePath)) {
    logger.fail(`Backup archive not found: ${archivePath}`);
    return;
  }

  logger.start(`Preparing restore from ${archivePath}`);

  const tarResolution = await resolveTarPath(archivePath, options?.passphrase);
  if (!tarResolution) return;

  const tarPath = tarResolution.tarPath;
  const cleanupPath = tarResolution.cleanupPath;
  const extractDir = await mkdtemp(join(tmpdir(), "sship-restore-"));

  try {
    const listResult = await runCapture("tar", ["-tzf", tarPath]);
    if (listResult.code !== 0) {
      logger.fail("Backup archive is invalid or unreadable.");
      if (listResult.stderr.trim()) {
        console.log(listResult.stderr.trim());
      }
      return;
    }

    const entries = listResult.stdout.split(/\r?\n/);
    const validation = validateArchiveEntries(entries);
    if (!validation.valid) {
      logger.fail(validation.reason || "Backup archive validation failed.");
      return;
    }
    if (validation.files.length === 0) {
      logger.warn("Backup archive contains no restorable files.");
      return;
    }

    const onlyFilter = parseOnlyFilter(options?.only);
    let filesToRestore = validation.files;
    if (onlyFilter) {
      const filtered = validation.files.filter((file) => onlyFilter.has(file));
      const missingRequested = [...onlyFilter].filter((name) => !validation.files.includes(name));
      if (missingRequested.length > 0) {
        logger.warn(`Requested files not present in archive: ${missingRequested.join(", ")}`);
      }
      filesToRestore = filtered;
    }

    if (filesToRestore.length === 0) {
      logger.warn("No matching files selected for restore.");
      return;
    }

    logger.info(`Files selected for restore: ${filesToRestore.join(", ")}`);

    let conflicts = 0;
    let wouldRestore = 0;
    for (const fileName of filesToRestore) {
      const destPath = join(SSH_DIR, fileName);
      if (existsSync(destPath)) {
        conflicts += 1;
      } else {
        wouldRestore += 1;
      }
    }

    if (conflicts > 0) {
      if (options?.force) {
        logger.warn(`${conflicts} existing file(s) will be overwritten (--force).`);
      } else {
        logger.warn(`${conflicts} existing file(s) will be skipped (use --force to overwrite).`);
      }
    }

    if (options?.dryRun) {
      const modeLabel = options?.force ? "restore/overwrite" : "restore";
      const overwriteCount = options?.force ? conflicts : 0;
      const skipCount = options?.force ? 0 : conflicts;
      logger.succeed(
        `Dry run complete. Would ${modeLabel} ${wouldRestore + overwriteCount} file(s); skip ${skipCount}.`
      );
      return;
    }

    const extractResult = await runCapture("tar", ["-xzf", tarPath, "-C", extractDir]);
    if (extractResult.code !== 0) {
      logger.fail("Failed to extract backup archive.");
      if (extractResult.stderr.trim()) {
        console.log(extractResult.stderr.trim());
      }
      return;
    }

    await mkdir(SSH_DIR, { recursive: true, mode: 0o700 });
    const extractedEntries = await readdir(extractDir);
    let restored = 0;
    let skipped = 0;

    for (const entry of extractedEntries) {
      if (!filesToRestore.includes(entry)) continue;
      const srcPath = join(extractDir, entry);
      const srcStats = await stat(srcPath);
      if (!srcStats.isFile()) continue;

      const destPath = join(SSH_DIR, basename(entry));
      if (existsSync(destPath) && !options?.force) {
        skipped += 1;
        logger.warn(`Skipping existing file: ${destPath} (use --force to overwrite)`);
        continue;
      }

      await copyFile(srcPath, destPath);
      if (destPath.endsWith(".pub")) {
        await chmod(destPath, 0o644);
      } else {
        await chmod(destPath, 0o600);
      }
      restored += 1;
    }

    logger.succeed(`Restore completed. Restored ${restored} file(s), skipped ${skipped}.`);
  } finally {
    await rm(extractDir, { recursive: true, force: true });
    if (cleanupPath) {
      await rm(cleanupPath, { force: true });
    }
  }
}
