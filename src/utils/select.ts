import { select as selectFromInquirer } from "@inquirer/prompts";

export type SelectChoice<T> = string | { name: string; value: T };

export async function select<T>(message: string, choices: SelectChoice<T>[]): Promise<T> {
  const formattedChoices = choices.map((choice) => {
    if (typeof choice === "string") {
      return { name: choice, value: choice as unknown as T };
    }
    return choice;
  });

  const answer = await selectFromInquirer({
    message: message,
    choices: formattedChoices,
  });
  return answer as T;
}

