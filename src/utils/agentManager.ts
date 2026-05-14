import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as childProcess from "child_process";
import { loadServiceKeys } from "./serviceKeys.ts";
import { ensureIdentityInAgent, type EnsureIdentityInAgentStatus } from "./sshAgent.ts";

const SSHIP_DIR = join(homedir(), ".sship");
const AGENT_ENV_PATH = join(SSHIP_DIR, "agent.env");
const AGENT_SOCKET_PATH = join(SSHIP_DIR, "agent.sock");

type AgentEnv = {
  SSH_AUTH_SOCK?: string;
  SSH_AGENT_PID?: string;
};

export type ManagedAgentStatus = {
  running: boolean;
  socketPath: string;
  agentPid?: string;
  identities: string;
};

export type ManagedFixResult = {
  startedAgent: boolean;
  keyResults: Record<string, EnsureIdentityInAgentStatus>;
  missingKeys: string[];
  status: ManagedAgentStatus;
};

function parseAgentOutput(output: string): AgentEnv {
  const env: AgentEnv = {};
  const sockMatch = output.match(/SSH_AUTH_SOCK=([^;]+);/);
  const pidMatch = output.match(/SSH_AGENT_PID=([^;]+);/);
  if (sockMatch?.[1]) env.SSH_AUTH_SOCK = sockMatch[1];
  if (pidMatch?.[1]) env.SSH_AGENT_PID = pidMatch[1];
  return env;
}

async function readStoredAgentEnv(): Promise<AgentEnv> {
  try {
    const raw = await readFile(AGENT_ENV_PATH, "utf-8");
    const env: AgentEnv = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!key) continue;
      const value = rest.join("=").trim();
      if (key === "SSH_AUTH_SOCK" || key === "SSH_AGENT_PID") {
        env[key] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

async function persistAgentEnv(env: AgentEnv): Promise<void> {
  await mkdir(SSHIP_DIR, { recursive: true });
  const content = [
    `SSH_AUTH_SOCK=${env.SSH_AUTH_SOCK ?? AGENT_SOCKET_PATH}`,
    `SSH_AGENT_PID=${env.SSH_AGENT_PID ?? ""}`,
  ].join("\n");
  await writeFile(AGENT_ENV_PATH, `${content}\n`, "utf-8");
}

function canTalkToAgent(): boolean {
  const spawnSync = childProcess.spawnSync;
  if (typeof spawnSync !== "function") return false;
  if (!process.env.SSH_AUTH_SOCK) return false;
  const result = spawnSync("ssh-add", ["-l"], {
    stdio: "ignore",
    env: process.env,
  });
  return result.status === 0 || result.status === 1;
}

function startManagedAgent(): AgentEnv | null {
  const spawnSync = childProcess.spawnSync;
  if (typeof spawnSync !== "function") return null;
  const env = { ...process.env };
  delete env.SSH_AUTH_SOCK;
  delete env.SSH_AGENT_PID;
  const started = spawnSync("ssh-agent", ["-s", "-a", AGENT_SOCKET_PATH], {
    encoding: "utf-8",
    env,
  });
  if (started.status !== 0) {
    return null;
  }
  const parsed = parseAgentOutput(`${started.stdout ?? ""}\n${started.stderr ?? ""}`);
  if (!parsed.SSH_AUTH_SOCK) {
    parsed.SSH_AUTH_SOCK = AGENT_SOCKET_PATH;
  }
  return parsed;
}

function listIdentityOutput(): string {
  const spawnSync = childProcess.spawnSync;
  if (typeof spawnSync !== "function") return "ssh-agent unavailable";
  const result = spawnSync("ssh-add", ["-l"], {
    encoding: "utf-8",
    env: process.env,
  });
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

export async function ensureManagedAgent(): Promise<{ startedAgent: boolean; status: ManagedAgentStatus }> {
  let startedAgent = false;
  if (!process.env.SSH_AUTH_SOCK) {
    const stored = await readStoredAgentEnv();
    if (stored.SSH_AUTH_SOCK) process.env.SSH_AUTH_SOCK = stored.SSH_AUTH_SOCK;
    if (stored.SSH_AGENT_PID) process.env.SSH_AGENT_PID = stored.SSH_AGENT_PID;
  }

  if (!canTalkToAgent()) {
    const started = startManagedAgent();
    if (started?.SSH_AUTH_SOCK) {
      process.env.SSH_AUTH_SOCK = started.SSH_AUTH_SOCK;
      if (started.SSH_AGENT_PID) process.env.SSH_AGENT_PID = started.SSH_AGENT_PID;
      await persistAgentEnv(started);
      startedAgent = true;
    }
  } else if (process.env.SSH_AUTH_SOCK) {
    await persistAgentEnv({
      SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
      SSH_AGENT_PID: process.env.SSH_AGENT_PID,
    });
  }

  const running = canTalkToAgent();
  const identities = running ? listIdentityOutput() : "ssh-agent unavailable";
  return {
    startedAgent,
    status: {
      running,
      socketPath: process.env.SSH_AUTH_SOCK ?? AGENT_SOCKET_PATH,
      agentPid: process.env.SSH_AGENT_PID,
      identities,
    },
  };
}

export async function fixManagedAgent(options?: { interactive?: boolean }): Promise<ManagedFixResult> {
  const { startedAgent } = await ensureManagedAgent();
  const keys = await loadServiceKeys();
  const keyResults: Record<string, EnsureIdentityInAgentStatus> = {};
  const missingKeys: string[] = [];

  for (const key of keys) {
    const privateKeyPath = join(homedir(), ".ssh", key);
    if (!existsSync(privateKeyPath)) {
      missingKeys.push(privateKeyPath);
      continue;
    }
    keyResults[key] = await ensureIdentityInAgent(privateKeyPath, {
      interactive: options?.interactive ?? true,
    });
  }

  const { status } = await ensureManagedAgent();
  return { startedAgent, keyResults, missingKeys, status };
}

export async function getManagedAgentStatus(): Promise<ManagedAgentStatus> {
  const { status } = await ensureManagedAgent();
  return status;
}

export async function installManagedAgentAutostart(): Promise<{ shellHook: boolean; service: boolean }> {
  await mkdir(SSHIP_DIR, { recursive: true });
  if (!existsSync(AGENT_ENV_PATH)) {
    await persistAgentEnv({
      SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK ?? AGENT_SOCKET_PATH,
      SSH_AGENT_PID: process.env.SSH_AGENT_PID,
    });
  }

  const serviceDir = join(homedir(), ".config", "systemd", "user");
  const serviceFile = join(serviceDir, "sship-agent.service");
  const bootstrapScript = join(SSHIP_DIR, "agent-bootstrap.sh");
  const shellHookScript = join(SSHIP_DIR, "agent-shell-hook.sh");
  // Clean up disabled hook from previous sessions
  const disabledHook = join(SSHIP_DIR, "agent-shell-hook.sh.disabled");

  let shellHook = false;
  let service = false;
  try {
    // Self-healing shell hook — designed to be sourced (not executed) in interactive shells.
    // Must NOT use `exit` (kills the shell) or `set -e` (aborts shell on ssh-add failure).
    const shellScript = `#!/usr/bin/env bash
# Added by sship — managed ssh-agent self-heal hook
SOCK="$HOME/.sship/agent.sock"
ENV_FILE="$HOME/.sship/agent.env"
# Load persisted env if present
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi
# Try current socket, then managed socket, then start fresh agent
if [ -n "\${SSH_AUTH_SOCK:-}" ] && SSH_AUTH_SOCK="$SSH_AUTH_SOCK" ssh-add -l >/dev/null 2>&1; then
  :
elif SSH_AUTH_SOCK="$SOCK" ssh-add -l >/dev/null 2>&1; then
  export SSH_AUTH_SOCK="$SOCK"
else
  rm -f "$SOCK"
  eval "$(ssh-agent -s -a "$SOCK")" >/dev/null 2>&1
fi
printf "SSH_AUTH_SOCK=%s\\nSSH_AGENT_PID=%s\\n" "\${SSH_AUTH_SOCK:-$SOCK}" "\${SSH_AGENT_PID:-}" > "$ENV_FILE"
export SSH_AUTH_SOCK="\${SSH_AUTH_SOCK:-$SOCK}"
`;
    await writeFile(shellHookScript, shellScript, "utf-8");
    await chmod(shellHookScript, 0o755);

    // Remove stale .disabled copy if present
    if (existsSync(disabledHook)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(disabledHook).catch(() => {});
    }

    // Inject source line into shell RC files (.zshrc, .bashrc)
    const hookSourceLine = `source "$HOME/.sship/agent-shell-hook.sh" # Added by sship`;
    const rcFiles = [".zshrc", ".bashrc"].map((f) => join(homedir(), f));
    for (const rcPath of rcFiles) {
      if (!existsSync(rcPath)) continue;
      try {
        const content = await readFile(rcPath, "utf-8");
        if (content.includes("agent-shell-hook.sh")) continue; // already present
        await writeFile(rcPath, `${content.trimEnd()}\n\n${hookSourceLine}\n`, "utf-8");
      } catch {
        // best effort
      }
    }
    shellHook = true;

    // Systemd user service for agent bootstrap (for login sessions before shell starts)
    await mkdir(serviceDir, { recursive: true });
    const bootstrapContent = `#!/usr/bin/env bash
set -euo pipefail
SOCK="$HOME/.sship/agent.sock"
ENV_FILE="$HOME/.sship/agent.env"
if SSH_AUTH_SOCK="$SOCK" ssh-add -l >/dev/null 2>&1; then
  exit 0
fi
rm -f "$SOCK"
eval "$(ssh-agent -s -a "$SOCK")" >/dev/null
printf "SSH_AUTH_SOCK=%s\\nSSH_AGENT_PID=%s\\n" "$SSH_AUTH_SOCK" "$SSH_AGENT_PID" > "$ENV_FILE"
`;
    await writeFile(bootstrapScript, bootstrapContent, "utf-8");
    await chmod(bootstrapScript, 0o755);

    const unit = `[Unit]
Description=sship managed ssh-agent bootstrap

[Service]
Type=oneshot
ExecStart=${bootstrapScript}

[Install]
WantedBy=default.target
`;
    await writeFile(serviceFile, unit, "utf-8");

    childProcess.spawnSync?.("systemctl", ["--user", "daemon-reload"], { stdio: "ignore" });
    childProcess.spawnSync?.("systemctl", ["--user", "enable", "--now", "sship-agent.service"], { stdio: "ignore" });
    service = true;
  } catch {
    service = false;
  }

  return { shellHook, service };
}

export async function removeManagedAgentShellHooks(): Promise<string[]> {
  const candidates = [".zshrc", ".zprofile", ".bashrc", ".bash_profile", ".profile"].map((file) =>
    join(homedir(), file)
  );
  const removedFrom: string[] = [];
  const patterns = [
    /agent-shell-hook\.sh/,
    /sship-agent/,
    /Added by sship/,
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const content = await readFile(filePath, "utf-8");
      if (!patterns.some((pattern) => pattern.test(content))) continue;

      const next = content
        .split(/\r?\n/)
        .filter((line) =>
          !patterns.some((pattern) => pattern.test(line))
        )
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trimEnd();

      await writeFile(filePath, next ? `${next}\n` : "", "utf-8");
      removedFrom.push(filePath);
    } catch {
      // best effort; keep going
    }
  }

  return removedFrom;
}
