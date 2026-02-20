import { existsSync, readdirSync, statSync } from "node:fs";

export function getAllFiles(location: string) {
  if (!existsSync(location)) {
    return [];
  }

  const files = readdirSync(location).filter((file) => {
    try {
      return statSync(`${location}/${file}`).isFile();
    } catch {
      return false;
    }
  });
  return files;
}
