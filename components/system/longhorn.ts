import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { GrafanaDashboard } from '../grafana-dashboard';
import { rootConfig } from '../root-config';
import dashboardJson from './longhorn-dashboard.json';

export interface LonghornArgs {
    domainName: string;
    enableMonitoring: boolean;
    s3EndpointUrl?: pulumi.Output<string>;
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

        const hostname = this.config.require('hostname');

        this.app = new Application(this, name, { namespace: `${name}-system` });

        const backupSecret = this.createBackupSecret();
        this.chart = this.createHelmRelease({
            backupSecretName: backupSecret?.metadata.name,
            hostname,
        });
        if (this.config.getBoolean('snapshotEnabled')) {
            this.createSnapshotJob();
        }
        if (this.config.getBoolean('trimEnabled')) {
            this.createTrimJob();
        }
        if (args.s3EndpointUrl && this.config.getBoolean('backupEnabled')) {
            this.createBackupJob();
        }
        if (args.enableMonitoring) {
            new GrafanaDashboard(name, this, { configJson: dashboardJson });
        }

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
    }

    private createHelmRelease({
        backupSecretName,
        hostname,
    }: {
        backupSecretName?: pulumi.Output<string>;
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
                              backupTarget: this.config.get('backupTarget'),
                              backupTargetCredentialSecret: backupSecretName,
                          }
                        : undefined,
                    defaultSettings: {
                        allowEmptyDiskSelectorVolume: false,
                        allowEmptyNodeSelectorVolume: true,
                        autoCleanupRecurringJobBackupSnapshot: true,
                        defaultDataLocality: 'best-effort',
                        defaultReplicaCount: rootConfig.longhorn.replicaCount,
                        deletingConfirmationFlag: false,
                        detachManuallyAttachedVolumesWhenCordoned: true,
                        fastReplicaRebuildEnabled: true,
                        nodeDownPodDeletionPolicy:
                            'delete-both-statefulset-and-deployment-pod',
                        orphanAutoDeletion: true,
                        recurringJobMaxRetention: 20,
                        replicaAutoBalance: 'best-effort',
                        replicaDiskSoftAntiAffinity: true,
                        replicaSoftAntiAffinity: false,
                        replicaZoneSoftAntiAffinity: false,
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
                    namespace: this.app.namespace,
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
