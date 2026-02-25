import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as kubernetes from '@pulumi/kubernetes';
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

        const technitiumIP = '10.43.0.53';
        this.createCoreDnsConfig(technitiumIP);

        this.app.addDeployment({
            clusterIP: technitiumIP,
            ports: [
                { name: 'http', port: 5380 },
                { name: 'dns-tcp', port: 53, tcp: true },
                { name: 'dns-udp', port: 53, tcp: true, udp: true },
            ],
            volumeMounts: [{ mountPath: '/etc/dns' }],
            env: {
                DNS_SERVER_DOMAIN: httpEndpointInfo.hostname,
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

    private createCoreDnsConfig(technitiumIP: string) {
        new kubernetes.core.v1.ConfigMap(
            'coredns-custom',
            {
                metadata: {
                    name: 'coredns-custom',
                    namespace: 'kube-system',
                },
                data: {
                    'forward.override': `forward . ${technitiumIP} {
    health_check 5s
}
forward . /etc/resolv.conf`,
                },
            },
            { parent: this },
        );
    }

    private createPassword() {
        return new random.RandomPassword(
            `${this.name}-admin-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }
}
