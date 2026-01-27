export type UserPromptMessage = {
  message: string;
  id: string;
  initialValue?: string;
};

export type tempWriteTasks = "create" | "task";

export type Tasks = 'serviceKeys' | 'backup' | 'uninstall' | 'doctor' | 'onboard' | 'servers' | 'transfer' | 'tunnel' | 'exit';

export type SshConfTemplate = {
  alias: string;
  hostname: string;
  user: string;
  port: number;
  identityFile: string;
  identitiesOnly: "yes" | "no";
};
