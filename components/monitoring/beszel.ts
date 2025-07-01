import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export class Beszel extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(name: string, opts?: pulumi.ResourceOptions) {
        super('orangelab:monitoring:Beszel', name, {}, opts);

        const config = new pulumi.Config(name);
        const hubKey = config.get('hubKey');

        this.app = new Application(this, name).addStorage().addDeployment({
            image: 'henrygd/beszel:latest',
            port: 8090,
            env: {
                USER_CREATION: 'true',
            },
            hostNetwork: true,
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
                    PORT: '45876',
                    KEY: hubKey,
                },
                resources: {
                    requests: { cpu: '5m', memory: '20Mi' },
                    limits: { memory: '100Mi' },
                },
            });
        }
    }
}
