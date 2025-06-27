import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../../application';
import { GrafanaDashboard } from '../../grafana-dashboard';
import { rootConfig } from '../../root-config';
import dashboardJson from './longhorn-dashboard.json';
import { MinioS3Bucket } from '../minio/minio-s3-bucket';
import { MinioS3User } from '../minio/minio-s3-user';

export interface LonghornArgs {
    domainName: string;
    enableMonitoring: boolean;
    s3EndpointUrl?: pulumi.Input<string>;
    minioProvider?: pulumi.ProviderResource;
}

export class Longhorn extends pulumi.ComponentResource {
    public static defaultStorageClass = 'longhorn';
    public static gpuStorageClass = 'longhorn-gpu';
    public static largeStorageClass = 'longhorn-large';
    public static databaseStorageClass = 'longhorn-database';

    public readonly endpointUrl: string | undefined;

    private readonly app: Application;
    private readonly config: pulumi.Config;
    private readonly chart: kubernetes.helm.v3.Release;

    constructor(
        private name: string,
        private args: LonghornArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Longhorn', name, args, opts);

        this.config = new pulumi.Config('longhorn');

        const hostname = this.config.require('hostname');

        this.app = new Application(this, name, { namespace: `${name}-system` });
        const backupEnabled =
            this.config.getBoolean('backupEnabled') &&
            args.s3EndpointUrl &&
            args.minioProvider;
        let backupSecret: kubernetes.core.v1.Secret | undefined;
        if (backupEnabled) {
            const s3User = this.createBackupUser();
            backupSecret = this.createBackupSecret(s3User);
            this.createBackupBucket(s3User);
        }
        this.chart = this.createHelmRelease({
            backupSecretName: backupSecret?.metadata.name,
            backupTarget: `s3://${this.config.require('backupBucket')}@lab/`,
            hostname,
        });
        this.createStorageClasses();

        if (this.config.getBoolean('snapshotEnabled')) {
            this.createSnapshotJob();
        }
        if (this.config.getBoolean('trimEnabled')) {
            this.createTrimJob();
        }
        if (backupEnabled) {
            this.createBackupJob();
        }
        if (args.enableMonitoring) {
            new GrafanaDashboard(name, this, { configJson: dashboardJson });
        }

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
    }

    private createHelmRelease({
        backupSecretName,
        backupTarget,
        hostname,
    }: {
        backupSecretName?: pulumi.Output<string>;
        backupTarget?: string;
        hostname: string;
    }) {
        return new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'longhorn',
                namespace: this.app.namespace,
                version: this.config.get('version'),
                repositoryOpts: { repo: 'https://charts.longhorn.io' },
                values: {
                    defaultBackupStore: backupSecretName
                        ? {
                              backupTarget,
                              backupTargetCredentialSecret: backupSecretName,
                          }
                        : undefined,
                    defaultSettings: {
                        allowEmptyDiskSelectorVolume: false,
                        allowEmptyNodeSelectorVolume: true,
                        autoCleanupRecurringJobBackupSnapshot: true,
                        autoCleanupSnapshotAfterOnDemandBackupCompleted: true,
                        autoCleanupSnapshotWhenDeleteBackup: true,
                        backupConcurrentLimit: 2,
                        defaultDataLocality: 'best-effort',
                        defaultReplicaCount: rootConfig.longhorn.replicaCount,
                        deletingConfirmationFlag: false,
                        detachManuallyAttachedVolumesWhenCordoned: true,
                        fastReplicaRebuildEnabled: true,
                        nodeDownPodDeletionPolicy:
                            'delete-both-statefulset-and-deployment-pod',
                        nodeDrainPolicy: 'always-allow',
                        offlineRelicaRebuilding: true,
                        orphanResourceAutoDeletion: 'replica-data;instance',
                        recurringJobMaxRetention: 10,
                        replicaAutoBalance: 'best-effort',
                        replicaDiskSoftAntiAffinity: true,
                        replicaSoftAntiAffinity: true,
                        replicaZoneSoftAntiAffinity: true,
                        snapshotMaxCount: 10,
                        storageMinimalAvailablePercentage: 10,
                        storageOverProvisioningPercentage: 100,
                        storageReservedPercentageForDefaultDisk: 30,
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
                        defaultClassReplicaCount: rootConfig.longhorn.replicaCount,
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

    private createStorageClasses() {
        new kubernetes.storage.v1.StorageClass(
            `${this.name}-gpu-storage`,
            {
                metadata: {
                    name: Longhorn.gpuStorageClass,
                    namespace: this.app.namespace,
                },
                allowVolumeExpansion: true,
                provisioner: 'driver.longhorn.io',
                volumeBindingMode: 'WaitForFirstConsumer',
                reclaimPolicy: 'Delete',
                parameters: {
                    numberOfReplicas: '1',
                    dataLocality: 'strict-local',
                    staleReplicaTimeout: (48 * 60).toString(),
                },
            },
            { dependsOn: this.chart, parent: this },
        );
        new kubernetes.storage.v1.StorageClass(
            `${this.name}-large-storage`,
            {
                metadata: {
                    name: Longhorn.largeStorageClass,
                    namespace: this.app.namespace,
                },
                allowVolumeExpansion: true,
                provisioner: 'driver.longhorn.io',
                volumeBindingMode: 'WaitForFirstConsumer',
                reclaimPolicy: 'Delete',
                parameters: {
                    numberOfReplicas: '1',
                    dataLocality: 'best-effort',
                    staleReplicaTimeout: (48 * 60).toString(),
                },
            },
            { dependsOn: this.chart, parent: this },
        );
        new kubernetes.storage.v1.StorageClass(
            `${this.name}-database-storage`,
            {
                metadata: {
                    name: Longhorn.databaseStorageClass,
                    namespace: this.app.namespace,
                },
                allowVolumeExpansion: true,
                provisioner: 'driver.longhorn.io',
                volumeBindingMode: 'WaitForFirstConsumer',
                reclaimPolicy: 'Delete',
                parameters: {
                    numberOfReplicas: '1',
                    dataLocality: 'strict-local',
                    staleReplicaTimeout: (48 * 60).toString(),
                },
            },
            { dependsOn: this.chart, parent: this },
        );
    }

    private createBackupSecret(s3User: MinioS3User) {
        if (!this.args.s3EndpointUrl) return;
        const secretName = `${this.name}-backup`;
        return new kubernetes.core.v1.Secret(
            `${secretName}-secret`,
            {
                metadata: {
                    name: secretName,
                    namespace: this.app.namespace,
                },
                stringData: {
                    AWS_ACCESS_KEY_ID: s3User.accessKey,
                    AWS_SECRET_ACCESS_KEY: s3User.secretKey,
                    AWS_ENDPOINTS: this.args.s3EndpointUrl,
                    VIRTUAL_HOSTED_STYLE: 'false',
                },
            },
            { parent: this, dependsOn: s3User },
        );
    }

    private createBackupUser() {
        return new MinioS3User(
            `${this.name}-minio-user`,
            { username: this.name },
            { parent: this, provider: this.args.minioProvider },
        );
    }

    private createBackupBucket(s3User: MinioS3User) {
        const bucketName = this.config.require('backupBucket');
        const createBucket = this.config.requireBoolean('backupBucketCreate');
        const bucket = new MinioS3Bucket(
            `${this.name}-minio-backup-bucket`,
            { bucketName, createBucket },
            { parent: this, provider: this.args.minioProvider },
        );
        bucket.grantReadWrite(s3User);
    }

    private createSnapshotJob() {
        const cron = this.config.require('snapshotCron');
        new kubernetes.apiextensions.CustomResource(
            `${this.name}-snapshot-job`,
            {
                apiVersion: 'longhorn.io/v1beta2',
                kind: 'RecurringJob',
                metadata: {
                    name: 'snapshot',
                    namespace: this.app.namespace,
                },
                spec: {
                    groups: ['default'],
                    task: 'snapshot',
                    cron,
                    name: 'snapshot',
                    retain: 10,
                    concurrency: 2,
                    labels: { cron },
                },
            },
            { dependsOn: this.chart, parent: this },
        );
    }

    private createBackupJob() {
        const cron = this.config.require('backupCron');
        new kubernetes.apiextensions.CustomResource(
            `${this.name}-backup-job`,
            {
                apiVersion: 'longhorn.io/v1beta2',
                kind: 'RecurringJob',
                metadata: {
                    name: 'backup',
                    namespace: this.app.namespace,
                },
                spec: {
                    groups: ['backup'],
                    task: 'backup',
                    cron,
                    name: 'backup',
                    retain: 10,
                    concurrency: 2,
                    labels: { cron },
                    parameters: {
                        'full-backup-interval': this.config.require('backupFullInterval'),
                    },
                },
            },
            { dependsOn: this.chart, parent: this },
        );
    }

    private createTrimJob() {
        const cron = this.config.require('trimCron');
        new kubernetes.apiextensions.CustomResource(
            `${this.name}-trim-job`,
            {
                apiVersion: 'longhorn.io/v1beta2',
                kind: 'RecurringJob',
                metadata: {
                    name: 'trim',
                    namespace: this.app.namespace,
                },
                spec: {
                    groups: ['default'],
                    task: 'filesystem-trim',
                    cron,
                    name: 'trim',
                    retain: 0,
                    concurrency: 2,
                    labels: { cron },
                },
            },
            { dependsOn: this.chart, parent: this },
        );
    }
}
