import type { tempWriteTasks } from "../types.ts";
import { mkdirSync, writeFileSync } from "node:fs";

export function writeResponses(
  responses: Record<string, string>,
  task: tempWriteTasks,
) {
  const path = `/tmp/sship/sship-${task}-responses.json`;
  mkdirSync("/tmp/sship", { recursive: true });
  writeFileSync(path, JSON.stringify(responses, null, 2));
}
