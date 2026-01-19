import { Command } from "commander";
import { manageProfiles } from "../utils/manageProfiles.ts";

export function registerManageProfilesCommand(program: Command) {
    program
        .command("profile")
        .description("Manage SSH profiles")
        .action(async () => {
            await manageProfiles();
        });
}
