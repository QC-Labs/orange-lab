import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export interface BeszelArgs {
    domainName: string;
}

export class Beszel extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;

    readonly deployment: kubernetes.apps.v1.Deployment | undefined;
    readonly appLabels = { app: 'beszel' };

    constructor(private name: string, args: BeszelArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Beszel', name, args, opts);

        const config = new pulumi.Config(name);
        const hubKey = config.get('hubKey');

        const app = new Application(this, name, { domainName: args.domainName })
            .addStorage()
            .addDeployment({
                image: 'henrygd/beszel:latest',
                port: 8090,
                env: {
                    USER_CREATION: 'true',
                },
                hostNetwork: true,
                volumeMounts: [{ mountPath: '/beszel_data' }],
            });

        if (hubKey) {
            app.withDeamonSet({
                name: 'agent',
                image: `henrygd/beszel-agent`,
                hostNetwork: true,
                env: {
                    PORT: '45876',
                    KEY: hubKey,
                },
            });
        }

        app.create();

        this.endpointUrl = app.endpointUrl;
    }
}
