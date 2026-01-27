export type TunnelType = "local" | "remote" | "dynamic";

export interface TunnelConfig {
    name: string;
    type: TunnelType;
    server: string; // SSH host alias or user@host
    localPort: number;
    remoteHost: string; // For local/remote forwarding
    remotePort: number; // For local/remote forwarding
    pid?: number; // Process ID when running
    createdAt: string;
}

export interface TunnelsFile {
    tunnels: TunnelConfig[];
}
