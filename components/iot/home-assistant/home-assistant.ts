import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';

export interface HomeAssistantArgs {
    trustedProxies?: string[];
}

export class HomeAssistant extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;

    constructor(name: string, args: HomeAssistantArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:iot:HomeAssistant', name, args, opts);

        const app = new Application(this, name).addStorage({
            overrideFullname: 'home-assistant-home-assistant-0',
        });

        if (app.storageOnly) return;
        const httpEndpointInfo = app.network.getHttpEndpointInfo();
        app.addHelmChart(
            name,
            {
                chart: 'home-assistant',
                repo: 'http://pajikos.github.io/home-assistant-helm-chart/',
                values: {
                    additionalMounts: [
                        { mountPath: '/run/dbus', name: 'dbus', readOnly: true },
                    ],
                    additionalVolumes: [
                        {
                            name: 'dbus',
                            hostPath: { path: '/run/dbus', type: 'Directory' },
                        },
                    ],
                    affinity: app.nodes.getAffinity(),
                    configuration: {
                        enabled: true,
                        trusted_proxies: args.trustedProxies ?? [],
                    },
                    fullnameOverride: name,
                    hostNetwork: true,
                    ingress: {
                        enabled: true,
                        className: httpEndpointInfo.className,
                        hosts: [
                            {
                                host: httpEndpointInfo.hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [
                            {
                                hosts: [httpEndpointInfo.hostname],
                                secretName: httpEndpointInfo.tlsSecretName,
                            },
                        ],
                    },
                    persistence: {
                        enabled: true,
                        storageClass: app.storage?.getStorageClass(),
                    },
                    replicaCount: 1,
                    securityContext: {
                        capabilities: {
                            add: ['NET_ADMIN', 'NET_RAW'],
                        },
                        seccompProfile: {
                            type: 'RuntimeDefault',
                        },
                        seLinuxOptions: {
                            type: 'spc_t',
                        },
                    },
                },
            },
            { dependsOn: app.storage },
        );

        this.endpointUrl = httpEndpointInfo.url;
    }
}
