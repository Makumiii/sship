import { logger } from "./logger.ts";
import { nestedNav } from "./nestedNav.ts";

type ProfileAction = "create" | "switch" | "delete" | "list" | "back";

export async function manageProfiles(): Promise<void> {
    while (true) {
        const action = await nestedNav<ProfileAction>("Manage Profiles", [
            { name: "➕ Create Profile", value: "create" },
            { name: "🔄 Switch Profile", value: "switch" },
            { name: "📋 List Profiles", value: "list" },
            { name: "🗑️  Delete Profile", value: "delete" }
        ]);

        if (action === "back") break;

        switch (action) {
            case "create":
                logger.info("Creating profile... (Not implemented)");
                break;
            case "switch":
                logger.info("Switching profile... (Not implemented)");
                break;
            case "list":
                logger.info("Listing profiles... (Not implemented)");
                break;
            case "delete":
                logger.info("Deleting profile... (Not implemented)");
                break;
        }
    }
}
