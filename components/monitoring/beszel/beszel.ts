import { Application, config, OidcProviderSettings } from '@orangelab/pulumi';
import * as pulumi from '@pulumi/pulumi';

export class Beszel extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private readonly name: string,
        private readonly args: { oidc?: OidcProviderSettings } = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:monitoring:Beszel', name, {}, opts);

        const hubKey = config.get(name, 'hubKey');
        const token = config.getSecret(name, 'TOKEN');
        this.app = new Application(this, name, {
            oidc: args.oidc,
        }).addStorage();
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        // when auth is enabled, password login is disabled - configure the
        // OAuth provider in the PocketBase superuser UI before `pulumi up`
        this.app.addDeployment({
            ports: [{ name: 'http', port: 8090 }],
            env: {
                USER_CREATION: 'true',
                // systems created by one user are not visible to others - share everything
                SHARE_ALL_SYSTEMS: 'true',
                APP_URL: httpEndpointInfo.url,
                ...(this.app.oidc ? { DISABLE_PASSWORD_AUTH: 'true' } : {}),
            },
            volumeMounts: [{ mountPath: '/beszel_data' }],
            resources: {
                requests: { cpu: '5m', memory: '50Mi' },
                limits: { memory: '200Mi' },
            },
        });

        if (hubKey) {
            this.app.addDaemonSet({
                name: 'agent',
                hostNetwork: true,
                env: {
                    LISTEN: '45876',
                    HUB_URL: httpEndpointInfo.url,
                },
                envSecret: {
                    KEY: hubKey,
                    TOKEN: token,
                },
                resources: {
                    requests: { cpu: '5m', memory: '20Mi' },
                    limits: { memory: '100Mi' },
                },
            });
        }
    }
}
