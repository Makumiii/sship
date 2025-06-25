export type UserPromptMessage = {
  message: string;
  id: string;
};

export type tempWriteTasks = "create";

export type SshConfTemplate = {
  alias:string
  hostname:string
  user:string
  port:number
  identityFile:string
  identitiesOnly:'yes' | 'no';
}