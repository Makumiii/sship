export type UserPromptMessage = {
  message: string;
  id: string;
  initialValue?: string;
};

export type tempWriteTasks = "create" | "task";

export type Tasks = 'create' | 'backup' | 'delete' | 'list' | 'uninstall' | 'manageProfiles' | 'connect' | 'doctor' | 'onboard' | 'servers';

export type SshConfTemplate = {
  alias: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string;
  identitiesOnly: "yes" | "no";
};


export type SshipUserProfile = {
  [profileName: string]: {
    ids: string[]

  }

}

export type SshipUserConfig = {
  profiles: SshipUserProfile
}
