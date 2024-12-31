import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export interface LonghornArgs {
    domainName: string;
}

// Homepage: https://longhorn.io/
export class Longhorn extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public gpuStorageClass = 'gpu-storage';

    constructor(name: string, args: LonghornArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:storage:Longhorn', name, args, opts);

        const config = new pulumi.Config('longhorn');
        const version = config.require('version');
        const hostname = config.require('hostname');
        const replicaCount = config.requireNumber('replicaCount');
        const enableMonitoring = config.requireBoolean('enableMonitoring');
        const gpuReplicaCount = config.requireNumber('gpuReplicaCount');

        const chart = new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'longhorn',
                namespace: 'longhorn-system',
                createNamespace: true,
                version,
                repositoryOpts: { repo: 'https://charts.longhorn.io' },
                values: {
                    defaultSettings: {
                        defaultDataLocality: 'best-effort',
                        defaultReplicaCount: replicaCount,
                        fastReplicaRebuildEnabled: true,
                        nodeDownPodDeletionPolicy:
                            'delete-both-statefulset-and-deployment-pod',
                        replicaAutoBalance: 'best-effort',
                        storageOverProvisioningPercentage: 100,
                        systemManagedComponentsNodeSelector: 'orangelab/storage:true',
                    },
                    global: {
                        nodeSelector: {
                            'orangelab/storage': 'true',
                        },
                    },
                    csi: {
                        attacherReplicaCount: 1,
                        provisionerReplicaCount: 1,
                        resizerReplicaCount: 1,
                        snapshotterReplicaCount: 1,
                    },
                    longhornUI: {
                        replicas: 1,
                    },
                    persistence: {
                        defaultClassReplicaCount: replicaCount,
                        defaultDataLocality: 'best-effort',
                    },
                    ingress: {
                        enabled: true,
                        host: hostname,
                        ingressClassName: 'tailscale',
                        tls: true,
                    },
                    metrics: enableMonitoring
                        ? { serviceMonitor: { enabled: true } }
                        : undefined,
                },
            },
            { parent: this },
        );

        new kubernetes.storage.v1.StorageClass(
            'gpu-storage',
            {
                metadata: {
                    name: this.gpuStorageClass,
                },
                allowVolumeExpansion: true,
                provisioner: 'driver.longhorn.io',
                volumeBindingMode: 'Immediate',
                reclaimPolicy: 'Delete',
                parameters: {
                    numberOfReplicas: gpuReplicaCount.toFixed(0),
                    dataLocality: 'strict-local',
                },
            },
            { dependsOn: chart, parent: this },
        );

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
    }
}
