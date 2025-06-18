import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { rootConfig } from '../root-config';

export interface N8nArgs {
    domainName: string;
}

export class N8n extends pulumi.ComponentResource {
    app: Application;

    constructor(name: string, args: N8nArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:N8n', name, args, opts);

        const config = new pulumi.Config(name);
        const hostname = config.require('hostname');

        this.app = new Application(this, name, {
            domainName: args.domainName,
        })
            .addStorage()
            .addDeployment({
                image: 'docker.n8n.io/n8nio/n8n',
                port: 5678,
                volumeMounts: [{ mountPath: '/home/node/.n8n' }],
                runAsUser: 1000,
                resources: {
                    requests: { memory: '250Mi' },
                    limits: { memory: '500Mi' },
                },
                env: {
                    N8N_PROTOCOL: 'http',
                    N8N_PORT: '5678',
                    N8N_HOST: hostname,
                    N8N_METRICS: rootConfig.enableMonitoring() ? 'true' : 'false',
                    N8N_DIAGNOSTICS_ENABLED: 'false',
                    N8N_SECURE_COOKIE: 'false',
                },
            });
    }
}
