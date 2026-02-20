import { Command } from "commander";
import onboardCommand from "../commands/onboard.ts";

export function registerOnboardCommand(program: Command) {
  program
    .command("onboard")
    .description("Onboard existing private keys by adding SSH aliases")
    .addHelpText(
      "after",
      "\nExample:\n  sship onboard\n"
    )
    .action(async () => {
      await onboardCommand();
    });
}
