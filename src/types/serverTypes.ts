export type ServerAuthMode = "identity_file" | "ssh_agent" | "password";

export interface ServerConfig {
    name: string;
    host: string;
    port: number;
    user: string;
    authMode: ServerAuthMode;
    identityFile?: string;
    createdAt: string;
}

export interface ServersFile {
    servers: ServerConfig[];
}
