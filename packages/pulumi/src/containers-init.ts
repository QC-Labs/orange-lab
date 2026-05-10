import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Metadata } from './metadata';
import { Storage } from './storage';
import { ContainerSpec, InitContainerSpec, VolumeMount } from './types';

export class InitContainers {
    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
            storage?: Storage;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    public create(
        spec: ContainerSpec,
    ): pulumi.Input<pulumi.Input<kubernetes.types.input.core.v1.Container>[]> {
        const initContainers = spec.initContainers ?? [];

        const mountPaths = this.getLocalVolumeMounts(spec.volumeMounts);
        if (spec.volumeOwnerUserId && mountPaths.length > 0) {
            initContainers.push(
                this.createPermissionsContainer(spec.volumeOwnerUserId, mountPaths),
            );
        }

        return initContainers.map(initContainer => ({
            name: initContainer.name,
            image: initContainer.image ?? 'busybox:latest',
            command: initContainer.command,
            imagePullPolicy: 'IfNotPresent',
            securityContext: this.createSecurityContext(),
            volumeMounts: this.createVolumeMounts(
                initContainer.volumeMounts ?? spec.volumeMounts,
            ),
        }));
    }

    private createPermissionsContainer(
        runAsUser: number,
        mountPaths: string[],
    ): InitContainerSpec {
        const userId = String(runAsUser);
        const paths = mountPaths.join(' ');
        return {
            name: 'fix-volume-permissions',
            command: ['sh', '-c', `chown ${userId}:${userId} ${paths}`],
        };
    }

    private getLocalVolumeMounts(volumeMounts?: VolumeMount[]): string[] {
        const volumeNames = this.args.storage?.getVolumeNames() ?? [this.appName];
        return (volumeMounts ?? [])
            .filter(mount => volumeNames.includes(mount.name ?? this.appName))
            .map(mount => mount.mountPath);
    }

    private createSecurityContext():
        | kubernetes.types.input.core.v1.SecurityContext
        | undefined {
        return this.args.storage?.hasLocal() ? { privileged: true } : undefined;
    }

    private createVolumeMounts(
        volumeMounts?: VolumeMount[],
    ): kubernetes.types.input.core.v1.VolumeMount[] | undefined {
        const mounts = (volumeMounts ?? []).map(volumeMount => ({
            ...volumeMount,
            ...{ name: volumeMount.name ?? this.appName },
        }));
        return mounts;
    }
}
