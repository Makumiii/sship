# SSHIP Agent Persistence Handoff

## Context and Goal
- User reported: after reboot, GitHub SSH fails (`Permission denied (publickey)`), and they had to delete/recreate service keys in `sship` for SSH to work again.
- Desired outcome: keys created with `sship` persist and SSH agent has/uses them reliably after reboot with minimal user intervention.

## Root Cause Identified
- The old flow only did best-effort `ssh-add` during certain commands.
- After reboot, agent state was lost and `SSH_AUTH_SOCK` could point to stale sockets.
- Recreating keys appeared to fix issue only because create flow re-ran `ssh-add`.
- Additional bug discovered during rollout: `sship agent --fix` could appear stuck due to blocking key-loaded checks in some environments.

## What Was Implemented

### 1) Managed Agent Subsystem
- Added new utility: `src/utils/agentManager.ts`
- Introduced managed runtime artifacts:
  - `~/.sship/agent.sock`
  - `~/.sship/agent.env`
  - `~/.sship/agent-bootstrap.sh` (systemd user bootstrap)
  - `~/.sship/agent-shell-hook.sh` (shell self-heal hook)
- Core behaviors:
  - Ensure agent exists and is reachable.
  - Start `ssh-agent` when missing.
  - Persist socket/pid env.
  - Load tracked service keys from `~/.sship/service-keys.json`.
  - Install shell and systemd user autostart (best effort).

### 2) New CLI/Interactive Agent Entry
- Added:
  - `src/commands/agent.ts`
  - `src/cli-commands/agent.ts`
- Registered command + interactive menu:
  - `sship agent`
  - `sship agent --fix`
  - `sship agent --restart` (same fix path)
- `src/index.ts` updated to register command and add interactive “Agent Health”.
- `src/types.ts` updated to include `agent` task.

### 3) Auto-Heal Integration into Existing SSH Paths
- Updated these flows to call managed agent ensure before identity operations:
  - `src/commands/createKey.ts`
  - `src/commands/serviceKeys.ts`
  - `src/commands/servers.ts`
  - `src/cli-commands/servers.ts`
  - `src/transfer/server.ts`
- `src/commands/init.ts` now does managed setup in `--fix` mode (agent bootstrap + hook install).

### 4) Hang Prevention in SSH Agent Key Check
- Updated `src/utils/sshAgent.ts`:
  - Added timeout protection for capture operations.
  - `ssh-add -T` loaded-check now times out instead of potentially blocking indefinitely.
- Updated `src/commands/agent.ts`:
  - Removed spinner for fix path to avoid “looks hung” UX during passphrase waits.

### 5) Delete-Key Stability Fix
- Updated `src/commands/deleteKey.ts`:
  - Removed module-load-time `homedir()` path caching.
  - Resolve SSH paths at runtime to avoid test and environment drift.

### 6) Test Stabilization for Bun Mocking Edge Cases
- Updated tests:
  - `tests/sshAgent.test.ts`
  - `tests/restoreCommand.test.ts`
  - `tests/deleteKeyCommand.test.ts`
  - `tests/serviceKeysCommand.test.ts`
- Addressed cross-test module mocking issues around `child_process`/`node:child_process`.

## Current Validation State
- `bun test` was brought to green in-session after the above edits.
- User verified working authentication in-session:
  - `ssh-add -l` showed GH key.
  - `ssh -T git@github.com` succeeded.
  - `git ls-remote git@github.com:Makumiii/sship.git` succeeded.
- After reboot, user hit:
  - `Error connecting to agent: No such file or directory`
  - indicating stale socket/env startup issue.
- This prompted the latest patch adding `agent-shell-hook.sh` self-heal behavior to startup hook generation.

## Most Recent Patch (Critical)
- `installManagedAgentAutostart()` now injects:
  - `source "$HOME/.sship/agent-shell-hook.sh" ...`
  instead of directly sourcing `agent.env`.
- `agent-shell-hook.sh` logic:
  1. Load env if present.
  2. Validate socket.
  3. Fall back to managed socket.
  4. Start `ssh-agent` if no valid socket.
  5. Rewrite `agent.env` with fresh values.

## User-Facing Commands Given (Latest)
1. `cd /home/maks/programming/sship`
2. `bun run build`
3. `npm link`
4. `sship init --fix`
5. `exec zsh`
6. Validate:
   - `echo $SSH_AUTH_SOCK`
   - `ssh-add -l`
7. If identities empty:
   - `ssh-add ~/.ssh/GH` once
8. Reboot and retest:
   - `ssh-add -l`
   - `ssh -T git@github.com`
   - `git ls-remote git@github.com:Makumiii/sship.git`

## What Another Agent Should Do Next
1. Confirm user has run latest rebuild/relink/init after shell-hook patch.
2. Collect post-reboot outputs:
   - `echo $SSH_AUTH_SOCK`
   - `cat ~/.sship/agent.env`
   - `sed -n '1,120p' ~/.sship/agent-shell-hook.sh`
   - `ssh-add -l`
3. If still failing:
   - Verify shell startup file actually sources hook (check `.zshrc`).
   - Verify `agent-shell-hook.sh` executes in non-login shell case.
   - Consider adding explicit zsh login/profile insertion if startup path mismatch persists.
4. If passphrase key remains unavoidable:
   - Clarify to user that first unlock after reboot may require passphrase entry unless OS keyring integration is added.
   - Optional enhancement: integrate keychain/gnome-keyring compatible caching guidance or command mode.

## Changed Files Summary
- Added:
  - `src/utils/agentManager.ts`
  - `src/commands/agent.ts`
  - `src/cli-commands/agent.ts`
  - `handoff.md` (this file)
- Modified:
  - `src/index.ts`
  - `src/types.ts`
  - `src/commands/init.ts`
  - `src/commands/createKey.ts`
  - `src/commands/serviceKeys.ts`
  - `src/commands/servers.ts`
  - `src/cli-commands/servers.ts`
  - `src/transfer/server.ts`
  - `src/utils/sshAgent.ts`
  - `src/commands/deleteKey.ts`
  - `tests/sshAgent.test.ts`
  - `tests/restoreCommand.test.ts`
  - `tests/deleteKeyCommand.test.ts`
  - `tests/serviceKeysCommand.test.ts`

## Important Caveat
- Even with full auto-heal, passphrase-protected keys may still require user unlock at least once per fresh agent lifecycle, depending on OS keyring/agent setup. The implementation aims to keep agent/socket valid and self-recovering so failure mode is controlled and explicit.
