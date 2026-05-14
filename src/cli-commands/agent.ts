import { Command } from "commander";
import agentCommand from "../commands/agent.ts";

export function registerAgentCommand(program: Command) {
  program
    .command("agent")
    .description("Inspect and repair managed ssh-agent state")
    .option("--fix", "Ensure managed ssh-agent is running and load tracked service keys")
    .option("--restart", "Alias for --fix")
    .action(async (options: { fix?: boolean; restart?: boolean }) => {
      await agentCommand(options);
    });
}
