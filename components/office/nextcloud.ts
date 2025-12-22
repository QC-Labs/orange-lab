import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { Application } from '../application';
import { IngressInfo } from '../network';
import { rootConfig } from '../root-config';
import { DatabaseConfig } from '../types';

export class Nextcloud extends pulumi.ComponentResource {
    public readonly serviceUrl?: string;
    public readonly app: Application;
    public readonly users: Record<string, pulumi.Output<string>> = {};
    public readonly dbConfig?: DatabaseConfig;

    private readonly config: pulumi.Config;

    constructor(
        private appName: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:office:Nextcloud', appName, {}, opts);

        this.config = new pulumi.Config(appName);

        this.app = new Application(this, appName).addStorage().addMariaDB();
        if (this.app.storageOnly) return;

        this.dbConfig = this.app.databases?.getConfig();
        if (!this.dbConfig) throw new Error('Database not found');
        const adminPassword =
            this.config.getSecret('adminPassword') ?? this.createPassword('admin');
        const adminSecret = this.createAdminSecret(adminPassword);
        const ingressInfo = this.app.network.getIngressInfo();
        this.users = { admin: adminPassword };
        this.createHelmChart({ ingressInfo, adminSecret, dbConfig: this.dbConfig });
        this.serviceUrl = ingressInfo.url;
    }

    private createHelmChart(args: {
        ingressInfo: IngressInfo;
        adminSecret: k8s.core.v1.Secret;
        dbConfig: DatabaseConfig;
    }) {
        const waitForDb = this.app.databases?.getWaitContainer();
        const debug = this.config.getBoolean('debug') ?? false;
        return this.app.addHelmChart(
            this.appName,
            {
                chart: 'nextcloud',
                repo: 'https://nextcloud.github.io/helm/',
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    externalDatabase: {
                        enabled: true,
                        type: 'mysql',
                        host: args.dbConfig.hostname,
                        user: args.dbConfig.username,
                        password: args.dbConfig.password,
                        database: args.dbConfig.database,
                    },
                    ingress: {
                        enabled: true,
                        className: args.ingressInfo.className,
                        hosts: [
                            {
                                host: args.ingressInfo.hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [
                            {
                                hosts: [args.ingressInfo.hostname],
                                secretName: args.ingressInfo.tlsSecretName,
                            },
                        ],
                        annotations: args.ingressInfo.annotations,
                    },
                    internalDatabase: { enabled: false },
                    livenessProbe: { enabled: true },
                    metrics: { enabled: true },
                    nextcloud: {
                        configs: {
                            'disable-skeleton.config.php': `<?php
$CONFIG = array (
    'skeletondirectory' => '',
);`,
                            ...(debug
                                ? {
                                      'logging.config.php': `<?php
$CONFIG = array (
    'log_type' => 'errorlog',
);`,
                                  }
                                : {}),
                        },
                        extraInitContainers: [waitForDb],
                        host: args.ingressInfo.hostname,
                        existingSecret: {
                            enabled: true,
                            secretName: args.adminSecret.metadata.name,
                            usernameKey: 'username',
                            passwordKey: 'password',
                        },
                        trustedDomains: [
                            rootConfig.tailnetDomain,
                            rootConfig.customDomain,
                            args.ingressInfo.hostname,
                        ],
                    },
                    persistence: {
                        enabled: true,
                        existingClaim: this.app.storage?.getClaimName(),
                    },
                    phpClientHttpsFix: {
                        enabled: args.ingressInfo.tls,
                        protocol: args.ingressInfo.tls ? 'https' : 'http',
                    },
                    readinessProbe: { enabled: true },
                    replicaCount: 1,
                    startupProbe: { enabled: true },
                },
            },
            { parent: this },
        );
    }

    private createAdminSecret(password: pulumi.Input<string>) {
        return new k8s.core.v1.Secret(
            `${this.appName}-admin-secret`,
            {
                metadata: { namespace: this.app.namespace },
                stringData: {
                    username: 'admin',
                    password,
                },
            },
            { parent: this },
        );
    }

    private createPassword(username: string) {
        return new random.RandomPassword(
            `${this.appName}-${username}-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
