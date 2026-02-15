import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';

export class Beszel extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private readonly name: string,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:monitoring:Beszel', name, {}, opts);

        const hubKey = config.get(name, 'hubKey');
        const token = config.getSecret(name, 'TOKEN');
        this.app = new Application(this, name).addStorage();
        const ingressInfo = this.app.network.getIngressInfo();

        this.app.addDeployment({
            port: 8090,
            env: {
                USER_CREATION: 'true',
                APP_URL: ingressInfo.url,
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
                image: config.require(this.name, 'agent/image'),
                hostNetwork: true,
                env: {
                    LISTEN: '45876',
                    HUB_URL: ingressInfo.url,
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
