import { select as selectFromInquirer} from "@inquirer/prompts";
export async function select(message:string, choices:string[]){
    console.log('Selecting from choices:', choices);
    const answer = await selectFromInquirer({
        message:message,
        choices:choices
    });
    return answer as unknown as string;

}