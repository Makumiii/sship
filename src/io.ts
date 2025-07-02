import { tempWriteTasks } from "./types.ts";

export function writeResponses(
  responses: Record<string, string>,
  task: tempWriteTasks,
) {
  const path = `/tmp/sship/sship-${task}-responses.json`;
  Deno.mkdirSync("/tmp/sship", { recursive: true });
  Deno.writeTextFileSync(path, JSON.stringify(responses, null, 2));
}
