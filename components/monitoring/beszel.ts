import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export class Beszel extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Beszel', name, {}, opts);

        const config = new pulumi.Config(name);
        const hubKey = config.get('hubKey');
        const token = config.getSecret('TOKEN');
        this.app = new Application(this, name).addStorage();
        const ingressInfo = this.app.network.getIngressInfo();

        this.app.addDeployment({
            image: 'henrygd/beszel:latest',
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
                image: `henrygd/beszel-agent`,
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
