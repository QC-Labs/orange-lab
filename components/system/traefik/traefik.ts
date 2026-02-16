import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'assert';

export class Traefik extends pulumi.ComponentResource {
    private readonly app: Application;
    private chart: kubernetes.helm.v3.Release;
    private readonly domain: string;

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
        config.requireEnabled(name, 'cert-manager');
        this.domain = config.customDomain;
        this.app = new Application(this, name);
        const crds = this.createGatewayAPICRDs();
        this.chart = this.createChart(crds);
        this.createCertificate();
        this.createDashboard();
    }

    private createGatewayAPICRDs(): kubernetes.yaml.ConfigFile {
        return new kubernetes.yaml.ConfigFile(
            `${this.name}-gateway-api-crds`,
            { file: config.require(this.name, 'gatewayApiCrdUrl') },
            { parent: this },
        );
    }

    private createChart(crds: kubernetes.yaml.ConfigFile): kubernetes.helm.v3.Release {
        return this.app.addHelmChart(
            this.name,
            {
                chart: 'traefik',
                repo: 'https://traefik.github.io/charts',
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    api: { dashboard: true },
                    deployment: { kind: 'DaemonSet' },
                    gateway: {
                        listeners: {
                            web: {
                                namespacePolicy: { from: 'All' },
                            },
                            websecure: {
                                port: 8443,
                                protocol: 'HTTPS',
                                namespacePolicy: { from: 'All' },
                                mode: 'Terminate',
                                certificateRefs: [
                                    {
                                        kind: 'Secret',
                                        group: '',
                                        name: `${this.domain}-tls`,
                                    },
                                ],
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
                            experimentalChannel: true,
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
            { deleteBeforeReplace: true, dependsOn: crds },
        );
    }

    private createCertificate() {
        if (!this.domain) return;

        const clusterIssuer = config.get('cert-manager', 'clusterIssuer');
        if (!clusterIssuer) {
            throw new Error(
                'cert-manager: clusterIssuer is required for wildcard certificate',
            );
        }

        new kubernetes.apiextensions.CustomResource(
            `${this.name}-certificate`,
            {
                apiVersion: 'cert-manager.io/v1',
                kind: 'Certificate',
                metadata: {
                    name: `${this.domain}-cert`,
                    namespace: this.app.metadata.namespace,
                },
                spec: {
                    secretName: `${this.domain}-tls`,
                    dnsNames: [`*.${this.domain}`, this.domain],
                    issuerRef: { name: clusterIssuer, kind: 'ClusterIssuer' },
                },
            },
            { parent: this, dependsOn: this.chart },
        );
    }

    private createDashboard() {
        const httpEndpointInfo = this.app.network.getHttpEndpointInfo();
        const metadata = this.app.metadata.get({ component: 'dashboard' });

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
                            match: `Host(\`${httpEndpointInfo.hostname}\`)`,
                            kind: 'Rule',
                            services: [{ name: 'api@internal', kind: 'TraefikService' }],
                        },
                    ],
                    tls: { secretName: `${this.domain}-tls` },
                },
            },
            { parent: this, dependsOn: this.chart },
        );
    }
}
