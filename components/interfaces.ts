export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    commandArgs?: string[];
    env?: Record<string, string | undefined>;
    gpu?: boolean;
    hostNetwork?: boolean;
    volumeMounts?: { mountPath: string; subPath?: string }[];
    healthChecks?: boolean;
    resources?: {
        limits?: { cpu?: string; memory?: string };
        requests?: { cpu?: string; memory?: string };
    };
    runAsUser?: number;
}
