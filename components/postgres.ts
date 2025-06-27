import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Metadata } from './metadata';
import { DatabaseConfig } from './types';
import { rootConfig } from './root-config';

export interface PostgresClusterArgs {
    name: string;
    metadata: Metadata;
    storageSize: pulumi.Input<string>;
    storageClassName?: pulumi.Input<string>;
    enabled?: boolean;
    fromPVC?: string;
    instances?: number;
}

export class PostgresCluster extends pulumi.ComponentResource {
    private readonly cluster?: kubernetes.apiextensions.CustomResource;
    private readonly secret: kubernetes.core.v1.Secret;

    private dbPassword: pulumi.Output<string>;
    private dbUser: string;
    private clusterName: string;

    constructor(
        private appName: string,
        private args: PostgresClusterArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:PostgresCluster', appName, args, opts);
        this.clusterName = `${appName}-${this.args.name}`;
        this.dbUser = appName;
        this.dbPassword = this.createPassword(this.dbUser);

        this.secret = this.createSecret();
        if (!args.enabled) return;

        this.cluster = this.createCluster();
    }

    private createSecret() {
        return new kubernetes.core.v1.Secret(
            `${this.clusterName}-secret`,
            {
                metadata: {
                    name: `${this.clusterName}-secret`,
                    namespace: this.args.metadata.namespace,
                    labels: { 'cnpg.io/watch': '' },
                },
                stringData: {
                    username: this.dbUser,
                    password: this.dbPassword,
                },
            },
            { parent: this },
        );
    }

    private createCluster(): kubernetes.apiextensions.CustomResource {
        const metadata = this.args.metadata.get({ component: this.args.name });
        const cluster = new kubernetes.apiextensions.CustomResource(
            this.clusterName,
            {
                apiVersion: 'postgresql.cnpg.io/v1',
                kind: 'Cluster',
                metadata,
                spec: {
                    instances: this.args.instances ?? 1,
                    inheritedMetadata: {
                        labels: this.args.metadata.getAppLabels(this.args.name),
                    },
                    bootstrap: {
                        initdb: {
                            database: this.appName,
                            owner: this.dbUser,
                            secret: { name: this.secret.metadata.name },
                        },
                    },
                    monitoring: rootConfig.enableMonitoring()
                        ? { enablePodMonitor: true }
                        : undefined,
                    storage: {
                        size: this.args.storageSize,
                        pvcTemplate: this.args.fromPVC
                            ? {
                                  dataSource: {
                                      apiGroup: 'v1',
                                      name: this.args.fromPVC,
                                      kind: 'PersistentVolumeClaim',
                                  },
                              }
                            : {
                                  accessModes: ['ReadWriteOnce'],
                                  resources: {
                                      requests: { storage: this.args.storageSize },
                                  },
                                  storageClassName: this.args.storageClassName,
                                  volumeMode: 'Filesystem',
                              },
                    },
                    resources: {
                        requests: { cpu: '100m', memory: '128Mi' },
                        limits: { memory: '1Gi' },
                    },
                },
            },
            { parent: this, dependsOn: [this.secret] },
        );
        return cluster;
    }

    getConfig(): DatabaseConfig {
        return {
            hostname: `${this.clusterName}-rw.${this.args.metadata.namespace}`,
            database: this.appName,
            username: this.dbUser,
            password: this.dbPassword,
        };
    }

    private createPassword(username: string) {
        return new random.RandomPassword(
            `${this.clusterName}-${username}-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
