import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";

const SSHIP_DIR = join(homedir(), ".sship");
const SERVICE_KEYS_FILE = join(SSHIP_DIR, "service-keys.json");

type ServiceKeyStore = {
    keys: string[];
};

async function ensureStorageDir(): Promise<void> {
    await mkdir(SSHIP_DIR, { recursive: true });
}

export async function loadServiceKeys(): Promise<string[]> {
    try {
        const raw = await readFile(SERVICE_KEYS_FILE, "utf-8");
        const parsed = JSON.parse(raw) as ServiceKeyStore;
        if (!Array.isArray(parsed.keys)) return [];
        return parsed.keys.filter((key) => typeof key === "string");
    } catch {
        return [];
    }
}

async function saveServiceKeys(keys: string[]): Promise<void> {
    await ensureStorageDir();
    const payload: ServiceKeyStore = { keys };
    await writeFile(SERVICE_KEYS_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export async function addServiceKey(name: string): Promise<void> {
    const keys = await loadServiceKeys();
    if (keys.includes(name)) return;
    keys.push(name);
    await saveServiceKeys(keys);
}

export async function removeServiceKey(name: string): Promise<void> {
    const keys = await loadServiceKeys();
    const next = keys.filter((key) => key !== name);
    await saveServiceKeys(next);
}
