import { tempWriteTasks } from "./types.ts";

export function WriteResponses(
  responses: Record<string, string>,
  task: tempWriteTasks,
) {
  const path = `/tmp/sship/sship-${task}-responses.json`;
  Deno.mkdirSync("/tmp/sship", { recursive: true });
  Deno.writeTextFileSync(path, JSON.stringify(responses, null, 2),);
  console.log(`Responses written to ${path}`);
  console.log('temp file written')
}
