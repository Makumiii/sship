import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ServerConfig } from "../types/serverTypes.ts";

export type BootstrapInstallResult = {
  privateKeyPath: string;
  publicKeyPath: string;
};

export function defaultServerKeyPath(serverName: string): string {
  return join(homedir(), ".ssh", `${serverName}_key`);
}

function runWithInherit(command: string, args: string[]): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", reject);
  });
}

function runWithCapture(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", reject);
  });
}

async function commandExists(command: string): Promise<boolean> {
  const result = await runWithCapture("bash", ["-lc", `command -v ${command}`]);
  return result.code === 0 && result.stdout.trim().length > 0;
}

export async function createServerKeyPair(
  privateKeyPath: string,
  options?: { comment?: string; passphrase?: string }
): Promise<string> {
  if (existsSync(privateKeyPath)) {
    throw new Error(`Private key already exists: ${privateKeyPath}`);
  }

  const comment = options?.comment ?? "sship-server-key";
  const passphrase = options?.passphrase ?? "";
  const args = ["-t", "ed25519", "-f", privateKeyPath, "-C", comment, "-N", passphrase];

  const code = await runWithInherit("ssh-keygen", args);
  if (code !== 0) {
    throw new Error("ssh-keygen failed");
  }

  return `${privateKeyPath}.pub`;
}

export async function ensurePublicKeyForPrivate(privateKeyPath: string): Promise<string> {
  if (!existsSync(privateKeyPath)) {
    throw new Error(`Private key not found: ${privateKeyPath}`);
  }

  const publicKeyPath = `${privateKeyPath}.pub`;
  if (existsSync(publicKeyPath)) {
    return publicKeyPath;
  }

  const result = await runWithCapture("ssh-keygen", ["-y", "-f", privateKeyPath]);
  if (result.code !== 0 || !result.stdout.trim()) {
    throw new Error(`Failed to derive public key from ${privateKeyPath}`);
  }

  await writeFile(publicKeyPath, `${result.stdout.trim()}\n`, "utf-8");
  await chmod(publicKeyPath, 0o644);
  return publicKeyPath;
}

export async function installPublicKeyOnServer(server: ServerConfig, publicKeyPath: string): Promise<void> {
  const hasSshCopyId = await commandExists("ssh-copy-id");
  if (!hasSshCopyId) {
    throw new Error("ssh-copy-id is required for bootstrap flow but was not found in PATH");
  }

  const target = `${server.user}@${server.host}`;
  const args = [
    "-i",
    publicKeyPath,
    "-p",
    String(server.port),
    "-o",
    "StrictHostKeyChecking=accept-new",
    target,
  ];

  const code = await runWithInherit("ssh-copy-id", args);
  if (code !== 0) {
    throw new Error("Failed to install public key on server");
  }
}

export async function verifyIdentityFileConnection(server: ServerConfig, privateKeyPath: string): Promise<boolean> {
  const args = [
    "-i",
    privateKeyPath,
    "-p",
    String(server.port),
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    `${server.user}@${server.host}`,
    "echo 'Connection successful!'",
  ];

  const code = await runWithInherit("ssh", args);
  return code === 0;
}

export async function prepareBootstrapKey(
  server: ServerConfig,
  options: { newKeyName?: string; existingKeyPath?: string; passphrase?: string }
): Promise<BootstrapInstallResult> {
  if (options.newKeyName && options.existingKeyPath) {
    throw new Error("Provide either newKeyName or existingKeyPath, not both");
  }

  if (!options.newKeyName && !options.existingKeyPath) {
    throw new Error("Provide newKeyName or existingKeyPath");
  }

  let privateKeyPath = "";
  let publicKeyPath = "";

  if (options.newKeyName) {
    privateKeyPath = join(homedir(), ".ssh", options.newKeyName);
    publicKeyPath = await createServerKeyPair(privateKeyPath, {
      comment: `${server.user}@${server.host}`,
      passphrase: options.passphrase,
    });
  } else {
    privateKeyPath = options.existingKeyPath!.replace(/^~/, process.env.HOME || "");
    publicKeyPath = await ensurePublicKeyForPrivate(privateKeyPath);
  }

  return { privateKeyPath, publicKeyPath };
}
