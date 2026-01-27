import { select, type SelectChoice } from "./select.ts";

export async function nestedNav<T extends string>(
    message: string,
    choices: SelectChoice<T>[]
): Promise<T> {
    return await select<T>(message, [
        ...choices,
        { name: "Go Back", value: "back" as T }
    ]);
}
