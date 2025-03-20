import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { GrafanaDashboard } from '../grafana-dashboard';
import dashboardJson from './longhorn-dashboard.json';

export interface LonghornArgs {
    domainName: string;
    enableMonitoring: boolean;
    s3EndpointUrl?: pulumi.Output<string>;
}

export class Longhorn extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public static defaultStorageClass = 'longhorn';
    public static gpuStorageClass = 'longhorn-gpu';

    private namespace: kubernetes.core.v1.Namespace;
    private readonly config: pulumi.Config;

    constructor(
        private name: string,
        private args: LonghornArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Longhorn', name, args, opts);

        this.config = new pulumi.Config('longhorn');
        const hostname = this.config.require('hostname');

        this.namespace = new kubernetes.core.v1.Namespace(
            `${name}-ns`,
            { metadata: { name: `${name}-system` } },
            { parent: this },
        );

        const backupSecret = this.createBackupSecret();

        const chart = this.createHelmRelease({
            backupSecretName: backupSecret?.metadata.name,
            hostname,
        });

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

    private createHelmRelease({
        backupSecretName,
        hostname,
    }: {
        backupSecretName?: pulumi.Output<string>;
        hostname: string;
    }) {
        const replicaCount = this.config.requireNumber('replicaCount');

        return new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'longhorn',
                namespace: this.namespace.metadata.name,
                version: this.config.get('version'),
                repositoryOpts: { repo: 'https://charts.longhorn.io' },
                values: {
                    defaultBackupStore: backupSecretName
                        ? {
                              backupTarget: this.config.get('backupTarget'),
                              backupTargetCredentialSecret: backupSecretName,
                          }
                        : undefined,
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
                    metrics: this.args.enableMonitoring
                        ? { serviceMonitor: { enabled: true } }
                        : undefined,
                },
            },
            { parent: this },
        );
    }

    private createBackupSecret() {
        const AWS_ACCESS_KEY_ID = this.config.get('backupAccessKeyId');
        const AWS_SECRET_ACCESS_KEY = this.config.get('backupAccessKeySecret');
        if (!this.args.s3EndpointUrl) return;
        if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) return;
        const secretName = `${this.name}-backup-secret`;
        return new kubernetes.core.v1.Secret(
            secretName,
            {
                metadata: {
                    name: secretName,
                    namespace: this.namespace.metadata.name,
                },
                stringData: {
                    AWS_ACCESS_KEY_ID,
                    AWS_SECRET_ACCESS_KEY,
                    AWS_ENDPOINTS: this.args.s3EndpointUrl,
                    VIRTUAL_HOSTED_STYLE: 'false',
                },
            },
            { parent: this },
        );
    }
}
