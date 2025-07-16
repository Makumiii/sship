import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function getAllFiles(location: string) {
  const files = readdirSync(location)
    .filter((file) => statSync(join(location, file)).isFile())
    .map((file) => file);
  return files;
}
