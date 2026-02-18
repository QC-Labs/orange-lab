import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import { HttpEndpointInfo } from '@orangelab/types';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { VaultwardenToken } from './vaultwarden-token';

export class Vaultwarden extends pulumi.ComponentResource {
    public readonly app: Application;
    public readonly adminToken?: pulumi.Output<string>;
    public readonly serviceUrl?: string;

    constructor(
        private appName: string,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:security:Vaultwarden', appName, {}, opts);

        this.app = new Application(this, appName).addStorage();
        if (this.app.storageOnly) return;

        const { plainToken, secretResource } = new VaultwardenToken(
            appName,
            this.app.metadata,
            { parent: this },
        );
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        this.createHelmChart({ httpEndpointInfo, adminTokenSecret: secretResource });

        this.adminToken = plainToken;
        this.serviceUrl = httpEndpointInfo.url;
    }

    private createHelmChart({
        httpEndpointInfo,
        adminTokenSecret,
    }: {
        httpEndpointInfo: HttpEndpointInfo;
        adminTokenSecret: kubernetes.core.v1.Secret;
    }) {
        const smtpHost = config.get(this.appName, 'smtp/host');
        const smtpFrom = config.get(this.appName, 'smtp/from');
        const smtpUsername = config.get(this.appName, 'smtp/username');
        const smtpPassword = config.getSecret(this.appName, 'smtp/password');
        const smtpPort = config.getNumber(this.appName, 'smtp/port');
        const signupsAllowed = config.requireBoolean(this.appName, 'signupsAllowed');
        const signupsVerify = config.requireBoolean(this.appName, 'signupsVerify');

        const smtpSecret = this.createSmtpSecret(smtpUsername, smtpPassword);

        return this.app.addHelmChart(
            this.appName,
            {
                chart: 'vaultwarden',
                repo: 'https://guerzon.github.io/vaultwarden/',
                values: {
                    adminToken: {
                        existingSecret: adminTokenSecret.metadata.name,
                        existingSecretKey: 'ADMIN_TOKEN_HASH',
                    },
                    affinity: this.app.nodes.getAffinity(),
                    domain: httpEndpointInfo.url,
                    ingress: {
                        enabled: true,
                        class: httpEndpointInfo.className,
                        hostname: httpEndpointInfo.hostname,
                        tls: httpEndpointInfo.tls,
                        tlsSecret: httpEndpointInfo.tlsSecretName,
                        additionalAnnotations: httpEndpointInfo.annotations,
                    },
                    invitationsAllowed: true,
                    resourceType: 'Deployment',
                    signupsAllowed,
                    signupsVerify,
                    smtp: {
                        ...(smtpHost ? { host: smtpHost } : {}),
                        ...(smtpFrom ? { from: smtpFrom } : {}),
                        ...(smtpPort ? { port: smtpPort } : {}),
                        ...(smtpSecret
                            ? {
                                  existingSecret: smtpSecret.metadata.name,
                                  username: { existingSecretKey: 'SMTP_USERNAME' },
                                  password: { existingSecretKey: 'SMTP_PASSWORD' },
                              }
                            : {}),
                    },
                    storage: {
                        enabled: true,
                        existingVolumeClaim: {
                            claimName: this.app.storage?.getClaimName(),
                            dataPath: '/data',
                            attachmentsPath: '/data/attachments',
                        },
                    },
                    webVaultEnabled: true,
                },
            },
            { parent: this },
        );
    }

    private createSmtpSecret(
        username: string | undefined,
        password: pulumi.Output<string> | undefined,
    ): kubernetes.core.v1.Secret | undefined {
        if (!username || !password) return undefined;

        return new kubernetes.core.v1.Secret(
            `${this.appName}-smtp`,
            {
                metadata: this.app.metadata.get(),
                stringData: {
                    SMTP_USERNAME: username,
                    SMTP_PASSWORD: password,
                },
            },
            { parent: this },
        );
    }
}
