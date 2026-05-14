import { Command } from "commander";
import doctorCommand from "../commands/doctor.ts";

export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description(
      "Checks SSH config for missing key files and offers to clean up.",
    )
    .option("--fix-all", "Automatically fix common issues without prompts")
    .option("--fix-shell", "Remove managed ssh-agent hooks from shell startup files")
    .action(async (options: { fixAll?: boolean; fixShell?: boolean }) => {
      await doctorCommand(options);
    });
}
