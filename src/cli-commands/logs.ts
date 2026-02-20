import { Command } from "commander";
import logsCommand from "../commands/logs.ts";

export function registerLogsCommand(program: Command) {
  program
    .command("logs")
    .description("View SSHIP logs")
    .option("-n, --lines <lines>", "Number of recent lines to show (default: 50)")
    .option("-l, --level <level>", "Filter by level: INFO|WARN|FAIL|SUCCESS|START|LOG")
    .addHelpText(
      "after",
      "\nExamples:\n  sship logs\n  sship logs --level FAIL --lines 100\n"
    )
    .action(async (options: { lines?: string; level?: string }) => {
      await logsCommand(options);
    });
}
