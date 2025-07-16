import { Command } from "commander";
import doctorCommand from "../commands/doctor.ts";

export function registerDoctorCommand(program: Command) {
  program
    .command("doctor")
    .description(
      "Checks SSH config for missing key files and offers to clean up.",
    )
    .action(async () => {
      await doctorCommand();
    });
}
