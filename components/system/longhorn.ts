import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { GrafanaDashboard } from '../grafana-dashboard';
import dashboardJson from './longhorn-dashboard.json';

export interface LonghornArgs {
    domainName: string;
    enableMonitoring: boolean;
}

export class Longhorn extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public static defaultStorageClass = 'longhorn';
    public static gpuStorageClass = 'longhorn-gpu';

    constructor(name: string, args: LonghornArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:system:Longhorn', name, args, opts);

        const config = new pulumi.Config('longhorn');
        const version = config.get('version');
        const hostname = config.require('hostname');
        const replicaCount = config.requireNumber('replicaCount');

        const namespace = new kubernetes.core.v1.Namespace(
            `${name}-ns`,
            { metadata: { name: `${name}-system` } },
            { parent: this },
        );

        const chart = new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'longhorn',
                namespace: namespace.metadata.name,
                version,
                repositoryOpts: { repo: 'https://charts.longhorn.io' },
                values: {
                    defaultSettings: {
                        allowEmptyDiskSelectorVolume: false,
                        allowEmptyNodeSelectorVolume: true,
                        defaultDataLocality: 'best-effort',
                        defaultReplicaCount: replicaCount,
                        fastReplicaRebuildEnabled: true,
                        nodeDownPodDeletionPolicy:
                            'delete-both-statefulset-and-deployment-pod',
                        orphanAutoDeletion: true,
                        replicaAutoBalance: 'best-effort',
                        snapshotMaxCount: 20,
                        storageMinimalAvailablePercentage: 25,
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
                    metrics: args.enableMonitoring
                        ? { serviceMonitor: { enabled: true } }
                        : undefined,
                },
            },
            { parent: this },
        );

        if (args.enableMonitoring) {
            new GrafanaDashboard(name, this, { configJson: dashboardJson });
        }

        new kubernetes.storage.v1.StorageClass(
            `${name}-gpu-storage`,
            {
                metadata: {
                    name: Longhorn.gpuStorageClass,
                },
                allowVolumeExpansion: true,
                provisioner: 'driver.longhorn.io',
                volumeBindingMode: 'Immediate',
                reclaimPolicy: 'Delete',
                parameters: {
                    numberOfReplicas: '1',
                    dataLocality: 'strict-local',
                },
            },
            { dependsOn: chart, parent: this },
        );

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
    }
}
