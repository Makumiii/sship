export type UserPromptMessage = {
  message: string;
  id: string;
};

export type tempWriteTasks = "create" | "task";

export type Tasks = 'create' | 'backup' | 'delete' | 'list' | 'uninstall'

export type SshConfTemplate = {
  alias: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string;
  identitiesOnly: "yes" | "no";
};

export type SshProfiles = {
  [profileName:string]:{
    ids:string[]

  }
}
