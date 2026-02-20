import { nestedNav } from "../utils/nestedNav.ts";
import createKeyCommand from "./createKey.ts";
import deleteCommand from "./deleteKey.ts";
import { select, type SelectChoice } from "../utils/select.ts";
import { loadServiceKeys } from "../utils/serviceKeys.ts";
import { getAllFiles } from "../utils/getAllFiles.ts";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";
import { copyToClipboard } from "../utils/clipboard.ts";
import { logger } from "../utils/logger.ts";
import { spawn } from "child_process";

type ServiceKeyAction = "create" | "list" | "back";

export async function manageServiceKeys(): Promise<void> {
    const action = await nestedNav<ServiceKeyAction>("Service Keys", [
        { name: "Create Key", value: "create" },
        { name: "Manage Keys", value: "list" },
    ]);

    switch (action) {
        case "create":
            await createKeyCommand();
            break;
        case "list":
            await manageServiceKeyEntries();
            break;
    }
}

async function manageServiceKeyEntries(): Promise<void> {
    const location = homedir();
    const fullLocation = `${location}/.ssh`;
    const storedKeys = await loadServiceKeys();
    if (!existsSync(fullLocation)) {
        logger.info("No service keys found");
        return;
    }
    const files = getAllFiles(fullLocation);
    const keys = storedKeys.filter((key) =>
        files.some((file) => file === key || file === `${key}.pub`)
    );

    if (keys.length === 0) {
        logger.info("No service keys found");
        return;
    }

    const keyChoices: SelectChoice<string>[] = [
        ...keys.map((key) => ({ name: key, value: key })),
        { name: "Back", value: "__back__" },
    ];

    const selectedKey = await select<string>("Select a key:", keyChoices);
    if (!selectedKey || selectedKey === "__back__") return;

    const actionChoices: SelectChoice<string>[] = [
        { name: "View Public Key", value: "view" },
        { name: "Test Connection", value: "test" },
        { name: "Delete Key", value: "delete" },
        { name: "Back", value: "back" },
    ];

    const action = await select<string>(`Action for "${selectedKey}":`, actionChoices);
    if (!action || action === "back") return;

    switch (action) {
        case "view":
            await viewPublicKey(fullLocation, selectedKey);
            break;
        case "test":
            await testServiceKeyConnection(selectedKey);
            break;
        case "delete":
            await deleteCommand(selectedKey);
            break;
    }
}

async function viewPublicKey(fullLocation: string, keyName: string): Promise<void> {
    const pubKeyPath = `${fullLocation}/${keyName}.pub`;

    if (!existsSync(pubKeyPath)) {
        logger.fail(`Public key not found: ${pubKeyPath}`);
        return;
    }

    const pubKeyContent = readFileSync(pubKeyPath, "utf-8").trim();

    logger.info("\nPublic Key:\n");
    console.log(pubKeyContent);
    console.log("");

    const copied = copyToClipboard(pubKeyContent);
    if (copied) {
        logger.succeed("Public key copied to clipboard.");
    } else {
        logger.warn(
            "Could not copy to clipboard (no clipboard tool found: xclip, xsel, or wl-copy)"
        );
    }
}

async function testServiceKeyConnection(alias: string): Promise<void> {
    logger.start(`Testing connection for "${alias}"...`);

    const strictArgs = [
        "-T",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        "-o", "IdentitiesOnly=yes",
        alias,
    ];

    const strictResult = await runSshProbe(strictArgs);
    const strictNormalized = strictResult.output.toLowerCase();
    const strictLooksSuccessful = /success|authenticated|welcome|hi /.test(strictNormalized);

    if (strictResult.code === 0 || strictLooksSuccessful) {
        logger.succeed(`Connection test succeeded for "${alias}"`);
        return;
    }

    const relaxedArgs = [
        "-T",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10",
        alias,
    ];
    const relaxedResult = await runSshProbe(relaxedArgs);
    const relaxedNormalized = relaxedResult.output.toLowerCase();
    const relaxedLooksSuccessful = /success|authenticated|welcome|hi /.test(relaxedNormalized);

    if (relaxedResult.code === 0 || relaxedLooksSuccessful) {
        logger.fail(`Connection test failed for "${alias}"`);
        logger.warn(
            `Alias key check failed, but another loaded SSH key can authenticate to this host.`
        );
        logger.info(
            `This usually means "${alias}" points to a key not added on the service account yet.`
        );
        logger.info(
            `Fix by uploading ~/.ssh/${alias}.pub for this account, or update the alias IdentityFile to your authorized key.`
        );
        return;
    }

    logger.fail(`Connection test failed for "${alias}"`);
    if (strictResult.output.trim()) {
        console.log(strictResult.output.trim());
    }
}

async function runSshProbe(args: string[]): Promise<{ code: number | null; output: string }> {
    return await new Promise<{ code: number | null; output: string }>((resolve) => {
        const child = spawn("ssh", args);
        let output = "";

        child.stdout.on("data", (chunk) => {
            output += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            output += chunk.toString();
        });
        child.on("close", (code) => {
            resolve({ code, output });
        });
        child.on("error", () => resolve({ code: 1, output: "" }));
    });
}
