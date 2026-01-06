import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { rootConfig } from '../root-config';

export class Traefik extends pulumi.ComponentResource {
    private readonly crdsChart: kubernetes.helm.v3.Release;
    private readonly app: Application;

    constructor(
        private name: string,
        args = {},
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:system:Traefik', name, args, opts);

        this.app = new Application(this, name, { existingNamespace: 'kube-system' });

        this.crdsChart = this.createCRDs();
        if (rootConfig.isEnabled('traefik')) {
            this.createChart();
            this.createDashboard();
        }
    }

    private createCRDs(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(`${this.name}-crds`, {
            chart: 'traefik-crds',
            repo: 'https://traefik.github.io/charts',
            values: {
                deleteOnUninstall: true,
            },
        });
    }

    private createChart(): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(
            this.name,
            {
                chart: 'traefik',
                repo: 'https://traefik.github.io/charts',
                skipCrds: true,
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    ingressClass: {
                        enabled: true,
                        isDefaultClass: true,
                        name: 'traefik',
                    },
                    priorityClassName: 'system-cluster-critical',
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
                    service: {
                        ipFamilyPolicy: 'PreferDualStack',
                    },
                    ports: {
                        web: {
                            redirections: {
                                entryPoint: {
                                    to: 'websecure',
                                    scheme: 'https',
                                    permanent: true,
                                },
                            },
                        },
                    },
                    api: {
                        dashboard: true,
                    },
                },
            },
            { dependsOn: [this.crdsChart] },
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
                        name: rootConfig.certManager.clusterIssuer,
                        kind: 'ClusterIssuer',
                    },
                },
            },
            { parent: this },
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
            { parent: this },
        );
    }
}
