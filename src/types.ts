export type UserPromptMessage = {
  message: string;
  id: string;
};

export type tempWriteTasks = "create" | "task";

export type Tasks = 'create' | 'backup' | 'delete' | 'list' | 'uninstall' | 'manageProfiles'

export type SshConfTemplate = {
  alias: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string;
  identitiesOnly: "yes" | "no";
};


export type SshipUserProfile = {
    [profileName:string]:{
    ids:string[]

  }

}

export type SshipUserConfig = {
  profiles:SshipUserProfile
}
