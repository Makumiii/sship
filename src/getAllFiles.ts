import { readdirSync, statSync } from "node:fs";

export function getAllFiles(location: string) {
  const files = readdirSync(location)
    .filter((file) => statSync(`${location}/${file}`).isFile())
    .map((file) => file);
  return files;
}
