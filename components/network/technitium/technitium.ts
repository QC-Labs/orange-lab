import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

export class Technitium extends pulumi.ComponentResource {
    public readonly endpointUrl: string;
    public readonly users: Record<string, pulumi.Output<string>> = {};

    private readonly app: Application;

    constructor(
        private name: string,
        args = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:network:Technitium', name, args, opts);

        this.app = new Application(this, name).addStorage();
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();

        const adminPassword =
            config.getSecret(name, 'adminPassword') ?? this.createPassword();
        this.users = { admin: adminPassword };

        this.app.addDeployment({
            clusterIP: '10.43.0.53',
            externalTrafficPolicy: 'Local',
            ports: [
                { name: 'http', port: 5380 },
                { name: 'dns-tcp', port: 53, tcp: true },
                { name: 'dns-udp', port: 53, tcp: true, udp: true },
            ],
            volumeMounts: [{ mountPath: '/etc/dns' }],
            env: {
                DNS_SERVER_DOMAIN: httpEndpointInfo.hostname,
                DNS_SERVER_FORWARDERS: config.require(name, 'DNS_SERVER_FORWARDERS'),
                DNS_SERVER_FORWARDER_PROTOCOL: config.require(
                    name,
                    'DNS_SERVER_FORWARDER_PROTOCOL',
                ),
            },
            envSecret: {
                DNS_SERVER_ADMIN_PASSWORD: this.users.admin,
            },
            resources: {
                requests: { cpu: '50m', memory: '128Mi' },
                limits: { memory: '512Mi' },
            },
        });

        this.endpointUrl = httpEndpointInfo.url;
    }

    private createPassword() {
        return new random.RandomPassword(
            `${this.name}-admin-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
