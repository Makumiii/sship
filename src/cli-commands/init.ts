import { Command } from "commander";
import initCommand from "../commands/init.ts";

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Run first-run preflight checks and optional environment setup")
    .option("--fix", "Create missing local directories (~/.ssh, ~/.sship)")
    .addHelpText(
      "after",
      "\nExamples:\n  sship init\n  sship init --fix\n"
    )
    .action(async (options: { fix?: boolean }) => {
      await initCommand(options);
    });
}
