import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export type EnsureIdentityInAgentStatus =
  | "added"
  | "already_loaded"
  | "skipped_no_agent"
  | "skipped_non_interactive"
  | "failed";

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

function runWithInherit(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", reject);
  });
}

async function keyAlreadyLoaded(publicKeyPath: string): Promise<boolean> {
  const testResult = await runWithCapture("ssh-add", ["-T", publicKeyPath]);
  if (testResult.code === 0) {
    return true;
  }

  const combinedOutput = `${testResult.stdout}\n${testResult.stderr}`.toLowerCase();
  if (combinedOutput.includes("unknown option") || combinedOutput.includes("illegal option")) {
    return false;
  }

  return false;
}

export async function ensureIdentityInAgent(
  privateKeyPath: string,
  options?: { interactive?: boolean }
): Promise<EnsureIdentityInAgentStatus> {
  if (!process.env.SSH_AUTH_SOCK) {
    return "skipped_no_agent";
  }

  const publicKeyPath = `${privateKeyPath}.pub`;
  if (existsSync(publicKeyPath)) {
    try {
      const loaded = await keyAlreadyLoaded(publicKeyPath);
      if (loaded) {
        return "already_loaded";
      }
    } catch {
      // Best-effort optimization only; continue to adding key.
    }
  }

  if (!options?.interactive && !process.stdin.isTTY) {
    return "skipped_non_interactive";
  }

  try {
    const code = await runWithInherit("ssh-add", [privateKeyPath]);
    return code === 0 ? "added" : "failed";
  } catch {
    return "failed";
  }
}
