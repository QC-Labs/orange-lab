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

export interface VolumeMount {
    mountPath: string;
    name?: string;
    subPath?: string;
    readOnly?: boolean;
}

export interface InitContainerSpec {
    name: string;
    /**
     * The Docker image to use for the init container.
     * Defaults to 'alpine:latest'.
     */
    image?: string;
    command?: string[];
    /**
     * Optional volume mounts for the init container.
     * If not provided, it will use the main container's volume mounts.
     */
    volumeMounts?: VolumeMount[];
}

/**
 * Represents the resource limits and requests for a container.
 */
export interface ContainerResources {
    limits?: {
        cpu?: string;
        memory?: string;
    };
    requests?: {
        cpu?: string;
        memory?: string;
    };
}

/**
 * Represents the specification for a container in a Kubernetes deployment.
 */
export interface ContainerSpec {
    name?: string;
    image: string;
    port?: number;
    ports?: ServicePort[];
    command?: string[];
    commandArgs?: string[] | pulumi.Output<string[]>;
    env?: Record<string, string | pulumi.Output<string> | undefined>;
    envSecret?: Record<string, string | pulumi.Output<string> | undefined>;
    hostNetwork?: boolean;
    initContainers?: InitContainerSpec[];
    volumeMounts?: VolumeMount[];
    healthChecks?: boolean;
    resources?: ContainerResources;
    runAsUser?: number;
    restartPolicy?: string;
}

/**
 * Represents a local volume using local-path provisioner.
 */
export interface LocalVolume {
    name: string;
    hostPath: string;
    type?: 'Directory' | 'DirectoryOrCreate' | 'FileOrCreate' | 'CharDevice';
}

/**
 * Represents a persistent volume configuration for Longhorn.
 */

export interface PersistentVolume {
    /**
     * The optional name suffix for the volume.
     * If provided, the full volume name will be `${appName}-${name}`.
     * If not provided, the `appName` will be used as the volume name.
     * This name also acts as a prefix for configuration lookups (e.g., `<name>/storageSize`).
     */
    name?: string;
    /**
     * The desired size of the persistent volume (e.g., "10Gi", "100Mi").
     * If not provided, the value will be sourced from the Pulumi config key
     * `${name}/storageSize` or `storageSize` if `name` is not set.
     */
    size?: string;
    /**
     * The type of persistent storage to use.
     * Defaults to `StorageType.Default` if not specified.
     */
    type?: StorageType;
    /**
     * Specifies an existing volume name to potentially restore data from.
     * This is typically used in conjunction with backup/restore mechanisms.
     * If not provided, the value might be sourced from the Pulumi config key
     * `${name}/fromVolume` or `fromVolume` if `name` is not set.
     */
    fromVolume?: string;
    /**
     * Specifies the name of an existing PersistentVolumeClaim (PVC) from which to clone data.
     * This directly populates the `dataSource` field of the new PVC.
     */
    cloneFromClaim?: string;
    /**
     * Allows explicitly setting the full name of the resulting PersistentVolumeClaim resource.
     * This is particularly useful for integration with StatefulSets using volume claim templates,
     * where Kubernetes automatically generates PVC names like `<volumeClaimTemplate.name>-<statefulSet.name>-<ordinalIndex>`.
     * If not provided, the name defaults to `${appName}-${name}` or just `appName`.
     * More info at https://longhorn.io/docs/1.8.1/snapshots-and-backups/backup-and-restore/restore-statefulset/
     */
    overrideFullname?: string;
}

/**
 * Represents a volume that contains configuration files mounted in the same folder.
 */
export interface ConfigVolume {
    /**
     * The name of the config volume.
     * If not provided, defaults to 'config'.
     */
    name?: string;
    /**
     * A map of configuration files to their contents.
     * The keys are the file names, and the values are the file contents.
     */
    files: Record<string, pulumi.Input<string>>;
}
