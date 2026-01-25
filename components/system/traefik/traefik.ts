import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'assert';

export class Traefik extends pulumi.ComponentResource {
    private readonly app: Application;
    private chart: kubernetes.helm.v3.Release | undefined;

    constructor(
        private name: string,
        args = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Traefik', name, args, opts);
        assert(
            config.customDomain,
            'Traefik component requires a custom domain to be set',
        );
        this.app = new Application(this, name);
        this.chart = this.createChart();
        this.createDashboard();
    }

    private createChart(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(
            this.name,
            {
                chart: 'traefik',
                repo: 'https://traefik.github.io/charts',
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    api: {
                        dashboard: true,
                    },
                    deployment: {
                        kind: 'DaemonSet',
                    },
                    gateway: {
                        listeners: {
                            web: {
                                namespacePolicy: {
                                    from: 'All',
                                },
                            },
                        },
                    },
                    global: {
                        checkNewVersion: false,
                        sendAnonymousUsage: false,
                    },
                    ingressClass: {
                        enabled: true,
                        isDefaultClass: true,
                        name: 'traefik',
                    },
                    ports: {
                        web: {
                            http: {
                                redirections: {
                                    entryPoint: {
                                        permanent: true,
                                        scheme: 'https',
                                        to: 'websecure',
                                    },
                                },
                            },
                        },
                    },
                    priorityClassName: 'system-cluster-critical',
                    providers: {
                        kubernetesGateway: {
                            enabled: true,
                        },
                    },
                    service: {
                        ipFamilyPolicy: 'PreferDualStack',
                    },
                    tolerations: [
                        {
                            key: 'CriticalAddonsOnly',
                            operator: 'Exists',
                        },
                        {
                            key: 'node-role.kubernetes.io/control-plane',
                            operator: 'Exists',
                            effect: 'NoSchedule',
                        },
                        {
                            key: 'node-role.kubernetes.io/master',
                            operator: 'Exists',
                            effect: 'NoSchedule',
                        },
                    ],
                },
            },
            { deleteBeforeReplace: true },
        );
    }

    private createDashboard() {
        const ingressInfo = this.app.network.getIngressInfo();
        const metadata = this.app.metadata.get({ component: 'dashboard' });

        new kubernetes.apiextensions.CustomResource(
            `${metadata.name}-certificate`,
            {
                apiVersion: 'cert-manager.io/v1',
                kind: 'Certificate',
                metadata,
                spec: {
                    secretName: ingressInfo.tlsSecretName,
                    dnsNames: [ingressInfo.hostname],
                    issuerRef: {
                        name: config.certManager.clusterIssuer,
                        kind: 'ClusterIssuer',
                    },
                },
            },
            { parent: this, dependsOn: this.chart },
        );

        new kubernetes.apiextensions.CustomResource(
            `${metadata.name}-ingressroute`,
            {
                apiVersion: 'traefik.io/v1alpha1',
                kind: 'IngressRoute',
                metadata,
                spec: {
                    entryPoints: ['websecure'],
                    routes: [
                        {
                            match: `Host(\`${ingressInfo.hostname}\`)`,
                            kind: 'Rule',
                            services: [
                                {
                                    name: 'api@internal',
                                    kind: 'TraefikService',
                                },
                            ],
                        },
                    ],
                    tls: {
                        secretName: ingressInfo.tlsSecretName,
                    },
                },
            },
            { parent: this, dependsOn: this.chart },
        );
    }
}
