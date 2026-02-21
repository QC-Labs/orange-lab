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

        this.users = {
            admin: this.createPassword(),
        };

        this.app.addDeployment({
            image: config.get(name, 'image') ?? 'technitium/dns-server:latest',
            ports: [
                { name: 'http', port: 5380 },
                { name: 'dns-tcp', port: 53, tcp: true },
                { name: 'dns-udp', port: 53 },
            ],
            hostNetwork: true,
            volumeMounts: [{ mountPath: '/etc/dns' }],
            env: {
                DNS_SERVER_FORWARDERS: config.get(name, 'forwarders'),
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
