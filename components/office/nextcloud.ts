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
    public readonly postgresConfig?: DatabaseConfig;

    private readonly config: pulumi.Config;

    constructor(private appName: string, opts?: pulumi.ComponentResourceOptions) {
        super('orangelab:office:Nextcloud', appName, {}, opts);

        this.config = new pulumi.Config(appName);

        this.app = new Application(this, appName).addStorage().addPostgres();
        if (this.app.storageOnly) return;

        this.postgresConfig = this.app.databases?.getConfig();
        const adminPassword =
            this.config.getSecret('adminPassword') ?? this.createPassword('admin');
        const adminSecret = this.createAdminSecret(adminPassword);
        const ingressInfo = this.app.network.getIngressInfo();
        this.users = { admin: adminPassword };
        this.createHelmChart({ ingressInfo, adminSecret });
        this.serviceUrl = ingressInfo.url;
    }

    private createHelmChart(args: {
        ingressInfo: IngressInfo;
        adminSecret: k8s.core.v1.Secret;
    }) {
        return new k8s.helm.v3.Release(
            this.appName,
            {
                chart: 'nextcloud',
                version: this.config.get('version'),
                repositoryOpts: { repo: 'https://nextcloud.github.io/helm/' },
                namespace: this.app.namespace,
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    externalDatabase: {
                        enabled: true,
                        type: 'postgresql',
                        host: this.postgresConfig?.hostname,
                        user: this.postgresConfig?.username,
                        password: this.postgresConfig?.password,
                        database: this.postgresConfig?.database,
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
                        tls: [{ hosts: [args.ingressInfo.hostname] }],
                    },
                    internalDatabase: { enabled: false },
                    metrics: { enabled: true },
                    nextcloud: {
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
                        ],
                    },
                    persistence: {
                        enabled: true,
                        existingClaim: this.app.storage?.getClaimName(),
                    },
                    replicaCount: 1,
                },
            },
            {
                parent: this,
                dependsOn: [
                    this.app.storage,
                    ...(this.app.databases?.getDependencies() ?? []),
                ].filter(Boolean) as pulumi.Input<pulumi.Input<pulumi.Resource>[]>,
            },
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
