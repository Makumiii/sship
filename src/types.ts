export type UserPromptMessage = {
  message: string;
  id: string;
  initialValue?: string;
};

export type tempWriteTasks = "create" | "task";

export type Tasks = 'create' | 'backup' | 'delete' | 'list' | 'uninstall' | 'connect' | 'doctor' | 'onboard' | 'servers' | 'transfer' | 'exit';

export type SshConfTemplate = {
  alias: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string;
  identitiesOnly: "yes" | "no";
};

