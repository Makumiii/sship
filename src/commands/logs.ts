import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";

type LogsOptions = {
  lines?: string | number;
  level?: string;
};

function normalizeLines(lines?: string | number): number {
  if (typeof lines === "number") return lines > 0 ? lines : 50;
  if (typeof lines === "string") {
    const parsed = Number.parseInt(lines, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
  }
  return 50;
}

export default async function logsCommand(options?: LogsOptions): Promise<void> {
  const logPath = join(homedir(), ".sship", "logs", "sship.log");
  if (!existsSync(logPath)) {
    logger.info("No logs found yet.");
    return;
  }

  const level = options?.level?.toUpperCase();
  const tailCount = normalizeLines(options?.lines);
  const raw = readFileSync(logPath, "utf-8");
  const allLines = raw.split(/\r?\n/).filter(Boolean);

  const filtered = level
    ? allLines.filter((line) => line.includes(`- ${level}:`))
    : allLines;
  const tail = filtered.slice(-tailCount);

  if (tail.length === 0) {
    logger.info("No log entries match the current filter.");
    return;
  }

  for (const line of tail) {
    console.log(line);
  }
}
