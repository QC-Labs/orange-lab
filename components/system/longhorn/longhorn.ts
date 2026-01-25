import { Application } from '@orangelab/application';
import { GrafanaDashboard } from '@orangelab/grafana-dashboard';
import { IngressInfo } from '@orangelab/network';
import { rootConfig } from '@orangelab/root-config';
import { S3Provisioner } from '@orangelab/s3-provisioner';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import dashboardJson from './longhorn-dashboard.json';

export interface LonghornArgs {
    s3Provisioner?: S3Provisioner;
}

export class Longhorn extends pulumi.ComponentResource {
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

        this.app = new Application(this, name, { namespace: `${name}-system` });
        const backupEnabled = this.config.getBoolean('backupEnabled') ?? false;
        const bucketName = this.config.require('backupBucket');
        const backupSecret = this.createBackupSecret(backupEnabled, bucketName);

        const ingresInfo = this.app.network.getIngressInfo();
        this.chart = this.createHelmRelease({
            backupSecretName: backupSecret?.metadata.name,
            backupTarget: backupEnabled ? `s3://${bucketName}@lab/` : undefined,
            ingresInfo,
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
        if (rootConfig.enableMonitoring()) {
            new GrafanaDashboard(name, { configJson: dashboardJson }, { parent: this });
        }

        this.endpointUrl = ingresInfo.url;
    }

    private createHelmRelease({
        backupSecretName,
        backupTarget,
        ingresInfo,
    }: {
        backupSecretName?: pulumi.Output<string>;
        backupTarget?: string;
        ingresInfo: IngressInfo;
    }) {
        return this.app.addHelmChart(this.name, {
            chart: 'longhorn',
            repo: 'https://charts.longhorn.io',
            values: {
                defaultBackupStore: backupSecretName
                    ? {
                          backupTarget,
                          backupTargetCredentialSecret: backupSecretName,
                      }
                    : undefined,
                defaultSettings: {
                    allowEmptyDiskSelectorVolume: 'false',
                    allowEmptyNodeSelectorVolume: 'true',
                    autoCleanupRecurringJobBackupSnapshot: 'true',
                    autoCleanupSnapshotAfterOnDemandBackupCompleted: 'true',
                    autoCleanupSnapshotWhenDeleteBackup: 'true',
                    backupConcurrentLimit: '2',
                    defaultDataLocality: 'best-effort',
                    defaultReplicaCount: rootConfig.longhorn.replicaCount.toString(),
                    deletingConfirmationFlag: 'false',
                    detachManuallyAttachedVolumesWhenCordoned: 'true',
                    fastReplicaRebuildEnabled: 'true',
                    nodeDownPodDeletionPolicy:
                        'delete-both-statefulset-and-deployment-pod',
                    nodeDrainPolicy: 'always-allow',
                    offlineRelicaRebuilding: 'true',
                    orphanResourceAutoDeletion: 'replica-data;instance',
                    recurringJobMaxRetention: '20',
                    replicaAutoBalance: rootConfig.longhorn.replicaAutoBalance,
                    replicaDiskSoftAntiAffinity: 'true',
                    replicaReplenishmentWaitInterval: '900',
                    replicaSoftAntiAffinity: 'true',
                    replicaZoneSoftAntiAffinity: 'true',
                    snapshotMaxCount: '10',
                    storageMinimalAvailablePercentage: '10',
                    storageOverProvisioningPercentage: '100',
                    storageReservedPercentageForDefaultDisk: '30',
                    systemManagedComponentsNodeSelector:
                        'node-role.kubernetes.io/longhorn=true',
                },
                global: {
                    nodeSelector: {
                        'node-role.kubernetes.io/longhorn': 'true',
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
                    host: ingresInfo.hostname,
                    ingressClassName: ingresInfo.className,
                    tls: ingresInfo.tls,
                    annotations: ingresInfo.annotations,
                },
                metrics: rootConfig.enableMonitoring()
                    ? { serviceMonitor: { enabled: true } }
                    : undefined,
            },
        });
    }

    private createStorageClasses() {
        new kubernetes.storage.v1.StorageClass(
            `${this.name}-gpu-storage`,
            {
                metadata: {
                    name: rootConfig.storageClass.GPU,
                    namespace: this.app.metadata.namespace,
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
            {
                dependsOn: this.chart,
                parent: this,
                replaceOnChanges: ['*'],
                deleteBeforeReplace: true,
            },
        );
        new kubernetes.storage.v1.StorageClass(
            `${this.name}-large-storage`,
            {
                metadata: {
                    name: rootConfig.storageClass.Large,
                    namespace: this.app.metadata.namespace,
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
            {
                dependsOn: this.chart,
                parent: this,
                replaceOnChanges: ['*'],
                deleteBeforeReplace: true,
            },
        );
    }

    private createBackupSecret(enabled: boolean, bucketName: string) {
        if (!enabled || !this.args.s3Provisioner) return;

        const { s3EndpointUrl, accessKey, secretKey } = this.args.s3Provisioner.create({
            username: this.name,
            bucket: bucketName,
        });

        const secretName = `${this.name}-backup`;
        return new kubernetes.core.v1.Secret(
            `${secretName}-secret`,
            {
                metadata: {
                    name: secretName,
                    namespace: this.app.metadata.namespace,
                },
                stringData: {
                    AWS_ACCESS_KEY_ID: accessKey,
                    AWS_SECRET_ACCESS_KEY: secretKey,
                    AWS_ENDPOINTS: s3EndpointUrl,
                    VIRTUAL_HOSTED_STYLE: 'false',
                },
            },
            { parent: this },
        );
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
                    namespace: this.app.metadata.namespace,
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
                    namespace: this.app.metadata.namespace,
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
                    namespace: this.app.metadata.namespace,
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
