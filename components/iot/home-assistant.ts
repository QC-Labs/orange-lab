import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';

export interface HomeAssistantArgs {
    domainName: string;
    trustedProxies?: string[];
}

export class HomeAssistant extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;

    constructor(name: string, args: HomeAssistantArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:iot:HomeAssistant', name, args, opts);

        const config = new pulumi.Config('home-assistant');
        const version = config.get('version');

        const app = new Application(this, name).addStorage({
            overrideFullname: 'home-assistant-home-assistant-0',
        });

        if (app.storageOnly) return;
        const ingressInfo = app.network.getIngressInfo();
        new kubernetes.helm.v3.Release(
            name,
            {
                chart: 'home-assistant',
                namespace: app.namespace,
                version,
                repositoryOpts: {
                    repo: 'http://pajikos.github.io/home-assistant-helm-chart/',
                },
                values: {
                    affinity: app.nodes.getAffinity(),
                    hostNetwork: true,
                    fullnameOverride: name,
                    ingress: {
                        enabled: true,
                        className: ingressInfo.className,
                        hosts: [
                            {
                                host: ingressInfo.hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [{ hosts: [ingressInfo.hostname] }],
                    },
                    configuration: {
                        enabled: true,
                        trusted_proxies: args.trustedProxies ?? [],
                    },
                    persistence: {
                        enabled: true,
                        storageClass: app.storage.getStorageClass(),
                    },
                    replicaCount: 1,
                },
            },
            { parent: this, dependsOn: app.storage },
        );

        this.endpointUrl = ingressInfo.url;
    }
}
