import { logger } from "../utils/logger.ts";
import { fixManagedAgent, getManagedAgentStatus } from "../utils/agentManager.ts";

export type AgentCommandOptions = {
  fix?: boolean;
  restart?: boolean;
};

export default async function agentCommand(options?: AgentCommandOptions): Promise<void> {
  if (options?.fix || options?.restart) {
    logger.info("Repairing managed ssh-agent state...");
    const result = await fixManagedAgent({ interactive: true });
    if (result.startedAgent) {
      logger.info("Started managed ssh-agent.");
    }
    if (result.missingKeys.length > 0) {
      logger.warn(`Missing key files: ${result.missingKeys.join(", ")}`);
    }
    for (const [key, status] of Object.entries(result.keyResults)) {
      if (status === "added") logger.info(`Loaded key: ${key}`);
    }
    if (result.status.running) {
      logger.succeed("Managed ssh-agent is healthy.");
      return;
    }
    logger.fail("Managed ssh-agent is not available.");
    return;
  }

  const status = await getManagedAgentStatus();
  logger.info(`Agent running: ${status.running ? "yes" : "no"}`);
  logger.info(`SSH_AUTH_SOCK: ${status.socketPath}`);
  if (status.agentPid) {
    logger.info(`SSH_AGENT_PID: ${status.agentPid}`);
  }
  logger.info(`Identities: ${status.identities || "none"}`);
}
