import * as pulumi from '@pulumi/pulumi';

export enum StorageType {
    Default,
    GPU,
    Large,
}

export interface ServicePort {
    name: string;
    port: number;
    hostname?: string;
    tcp?: boolean;
}

export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    ports?: ServicePort[];
    commandArgs?: string[];
    env?: Record<string, string | pulumi.Output<string> | undefined>;
    hostNetwork?: boolean;
    volumeMounts?: { mountPath: string; name?: string; subPath?: string }[];
    healthChecks?: boolean;
    resources?: {
        limits?: { cpu?: string; memory?: string };
        requests?: { cpu?: string; memory?: string };
    };
    runAsUser?: number;
    restartPolicy?: string;
}
