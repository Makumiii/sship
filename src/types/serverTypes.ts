export interface ServerConfig {
    name: string;
    host: string;
    port: number;
    user: string;
    pemKeyPath: string;
    createdAt: string;
}

export interface ServersFile {
    servers: ServerConfig[];
}
