import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Metadata } from './metadata';
import { DatabaseConfig } from './types';

export interface MariaDbClusterArgs {
    name: string;
    metadata: Metadata;
    storageSize: pulumi.Input<string>;
    storageClassName?: pulumi.Input<string>;
    storageOnly?: boolean;
    disableAuth?: boolean;
    enabled?: boolean;
    rootPassword?: pulumi.Input<string>;
    password?: pulumi.Input<string>;
}

export class MariaDbCluster extends pulumi.ComponentResource {
    private readonly mariadb?: kubernetes.apiextensions.CustomResource;
    private readonly secret: kubernetes.core.v1.Secret;

    private dbPassword: pulumi.Output<string>;
    private rootPassword: pulumi.Output<string>;
    private dbUser: string;
    private clusterName: string;

    constructor(
        private appName: string,
        private args: MariaDbClusterArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:MariaDbCluster', appName, args, opts);
        this.clusterName = `${appName}-${this.args.name}`;
        this.dbUser = appName;
        this.dbPassword = pulumi.output(
            args.password ?? this.createPassword(this.dbUser),
        );
        this.rootPassword = pulumi.output(
            this.args.rootPassword ?? this.createPassword('root'),
        );

        this.secret = this.createSecret();
        if (!args.enabled) return;
        this.mariadb = this.createCluster();
    }

    private createSecret() {
        return new kubernetes.core.v1.Secret(
            `${this.clusterName}-secret`,
            {
                metadata: {
                    name: `${this.clusterName}-secret`,
                    namespace: this.args.metadata.namespace,
                    labels: { 'k8s.mariadb.com/watch': '' },
                },
                stringData: {
                    username: this.dbUser,
                    password: this.dbPassword,
                    rootPassword: this.rootPassword,
                },
            },
            { parent: this },
        );
    }

    private createCluster(): kubernetes.apiextensions.CustomResource {
        const metadata = this.args.metadata.get({ component: this.args.name });
        const myCnf = pulumi.interpolate`
        [mariadb]
        skip-name-resolve
        temp-pool
        ${this.args.disableAuth ? 'skip-grant-tables' : ''}
        ${this.args.disableAuth ? 'skip-networking' : ''}
        `;
        return new kubernetes.apiextensions.CustomResource(
            this.clusterName,
            {
                apiVersion: 'k8s.mariadb.com/v1alpha1',
                kind: 'MariaDB',
                metadata,
                spec: {
                    database: this.appName,
                    inheritMetadata: {
                        labels: this.args.metadata.getAppLabels(this.args.name),
                    },
                    metrics: { enabled: true },
                    myCnf,
                    passwordSecretKeyRef: {
                        name: this.secret.metadata.name,
                        key: 'password',
                        generate: false,
                    },
                    replicas: 1,
                    resources: {
                        requests: { cpu: '100m', memory: '128Mi' },
                        limits: { memory: '1Gi' },
                    },
                    rootPasswordSecretKeyRef: {
                        name: this.secret.metadata.name,
                        key: 'rootPassword',
                        generate: false,
                    },
                    storage: {
                        volumeClaimTemplate: {
                            accessModes: ['ReadWriteOnce'],
                            resources: {
                                requests: { storage: this.args.storageSize },
                            },
                            storageClassName: this.args.storageClassName,
                        },
                    },
                    suspend: false,
                    username: this.dbUser,
                },
            },
            { parent: this, dependsOn: [this.secret] },
        );
    }

    getConfig(): DatabaseConfig {
        return {
            hostname: this.clusterName,
            database: this.appName,
            username: this.appName,
            password: this.dbPassword,
            port: 3306,
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
