import { spawnSync } from "node:child_process";
import { homedir, platform } from "node:os";
import { existsSync } from "node:fs";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";
import { ensureManagedAgent, installManagedAgentAutostart } from "../utils/agentManager.ts";

type InitOptions = {
  fix?: boolean;
};

type CheckResult = {
  name: string;
  required: boolean;
  ok: boolean;
  message: string;
};

function hasCommand(binary: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${binary}`], { stdio: "ignore" });
  return check.status === 0;
}

function detectOpenerBinary(): string {
  return platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
}

async function ensureDir(path: string, mode?: number): Promise<void> {
  await mkdir(path, { recursive: true, mode });
  if (typeof mode === "number") {
    await chmod(path, mode);
  }
}

export default async function initCommand(options?: InitOptions): Promise<void> {
  const home = homedir();
  const sshDir = join(home, ".ssh");
  const sshipDir = join(home, ".sship");
  const fix = Boolean(options?.fix);

  logger.start("Running first-run preflight checks...");

  const checks: CheckResult[] = [
    {
      name: "ssh",
      required: true,
      ok: hasCommand("ssh"),
      message: "SSH client",
    },
    {
      name: "tar",
      required: true,
      ok: hasCommand("tar"),
      message: "tar archive tool",
    },
    {
      name: "gpg",
      required: false,
      ok: hasCommand("gpg"),
      message: "GPG encryption (optional, used for encrypted backups)",
    },
    {
      name: "jq",
      required: false,
      ok: hasCommand("jq"),
      message: "jq JSON parser (optional, used by shell scripts)",
    },
    {
      name: detectOpenerBinary(),
      required: false,
      ok: hasCommand(detectOpenerBinary()),
      message: "browser opener (optional, used by transfer auto-open)",
    },
    {
      name: "~/.ssh",
      required: true,
      ok: existsSync(sshDir),
      message: "SSH directory",
    },
    {
      name: "~/.sship",
      required: false,
      ok: existsSync(sshipDir),
      message: "SSHIP app directory",
    },
  ];

  for (const check of checks) {
    if (check.ok) {
      logger.info(`OK: ${check.message}`);
      continue;
    }
    const fixableRequired = fix && (check.name === "~/.ssh");
    const level = check.required && !fixableRequired ? "FAIL" : "WARN";
    if (level === "FAIL") {
      logger.fail(`Missing required: ${check.message} (${check.name})`);
    } else if (fixableRequired) {
      logger.warn(`Missing required (will fix): ${check.message} (${check.name})`);
    } else {
      logger.warn(`Missing optional: ${check.message} (${check.name})`);
    }
  }

  if (fix) {
    if (!existsSync(sshDir)) {
      await ensureDir(sshDir, 0o700);
      logger.info("Created ~/.ssh with secure permissions.");
    }
    if (!existsSync(sshipDir)) {
      await ensureDir(sshipDir);
      logger.info("Created ~/.sship directory.");
    }
    const { startedAgent, status } = await ensureManagedAgent();
    if (startedAgent) {
      logger.info("Started managed ssh-agent.");
    }
    if (status.running) {
      logger.info(`Managed ssh-agent ready at ${status.socketPath}.`);
    } else {
      logger.warn("Managed ssh-agent could not be validated. SSH operations may still require manual setup.");
    }

    const autostart = await installManagedAgentAutostart();
    if (autostart.shellHook) {
      logger.info("Installed shell hook for managed ssh-agent auto-heal.");
    } else {
      logger.warn("Could not install shell hook for managed agent (best-effort step).");
    }
    if (autostart.service) {
      logger.info("Installed/enabled user service for managed ssh-agent bootstrap.");
    } else {
      logger.warn("Could not enable systemd user service for managed agent bootstrap (best-effort step).");
    }
  }

  const requiredFailures = checks.filter((c) => c.required && !c.ok && !(fix && (c.name === "~/.ssh")));
  if (requiredFailures.length > 0) {
    logger.fail("Preflight completed with required failures. Install missing tools and re-run `sship init`.");
    return;
  }

  logger.succeed("Preflight complete. Environment is ready.");
}
