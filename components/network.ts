import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Metadata } from './metadata';
import { ContainerSpec, ServicePort } from './types';

export class Network {
    serviceUrl?: string;
    endpointUrl?: string;

    private readonly config: pulumi.Config;
    private readonly metadata: Metadata;
    private readonly scope: pulumi.ComponentResource;
    private readonly domainName?: string;

    constructor(
        private readonly appName: string,
        args: {
            readonly scope: pulumi.ComponentResource;
            readonly config: pulumi.Config;
            readonly metadata: Metadata;
            readonly domainName?: string;
        },
    ) {
        this.config = args.config;
        this.metadata = args.metadata;
        this.scope = args.scope;
        this.domainName = args.domainName;
    }

    createEndpoints(spec: ContainerSpec) {
        const hostname = this.config.get('hostname');
        if (!hostname) return;
        assert(this.domainName, 'domainName is required');
        const metadata = this.metadata.get({ component: spec.name });
        assert(metadata.namespace, 'namespace is required');

        const ports: ServicePort[] = [
            ...(spec.port ? [{ name: 'http', port: spec.port, hostname }] : []),
            ...(spec.ports ?? []),
        ];
        if (ports.length === 0) return;

        const httpPorts = ports.filter(p => !p.tcp);
        if (httpPorts.length) {
            const service = this.createService({
                component: spec.name,
                ports: httpPorts,
            });
            this.createIngress({ service, ports: httpPorts, component: spec.name });
        }
        const tcpPorts = ports.filter(p => p.tcp);
        if (tcpPorts.length) {
            this.createLoadBalancer({ hostname, ports: tcpPorts, component: spec.name });
        }
        const port = ports[0].port.toString();
        this.serviceUrl = `http://${hostname}.${metadata.namespace}:${port}`;
        this.endpointUrl = `https://${hostname}.${this.domainName}`;
    }

    private createService(args: {
        component?: string;
        ports: ServicePort[];
    }): kubernetes.core.v1.Service {
        const servicePorts = args.ports.map(p => ({
            name: p.name,
            protocol: 'TCP',
            port: p.port,
            targetPort: p.port,
        }));
        const metadata = this.metadata.get({ component: args.component });
        return new kubernetes.core.v1.Service(
            `${metadata.name}-svc`,
            {
                metadata,
                spec: {
                    type: 'ClusterIP',
                    ports: servicePorts,
                    selector: this.metadata.getSelectorLabels(args.component),
                },
            },
            { parent: this.scope },
        );
    }

    private createLoadBalancer(args: {
        hostname: string;
        ports: ServicePort[];
        component?: string;
    }) {
        const metadata = this.metadata.get({ component: args.component });
        new kubernetes.core.v1.Service(
            `${metadata.name}-lb`,
            {
                metadata: {
                    ...metadata,
                    annotations: { 'tailscale.com/hostname': args.hostname },
                },
                spec: {
                    type: 'LoadBalancer',
                    loadBalancerClass: 'tailscale',
                    ports: args.ports.map(p => ({
                        name: p.name,
                        protocol: 'TCP',
                        port: p.port,
                        targetPort: p.port,
                    })),
                    selector: this.metadata.getSelectorLabels(),
                },
            },
            { parent: this.scope },
        );
    }

    private createIngress(args: {
        service: kubernetes.core.v1.Service;
        ports: ServicePort[];
        component?: string;
    }): kubernetes.networking.v1.Ingress[] {
        assert(this.domainName, 'domainName is required for ingress');
        return args.ports.map(port => {
            assert(port.hostname, `hostname is required for port ${port.name}`);
            const componentName = args.component
                ? `${args.component}-${port.name}`
                : port.name;
            const metadata = this.metadata.get({ component: componentName });
            return new kubernetes.networking.v1.Ingress(
                `${metadata.name}-ingress`,
                {
                    metadata,
                    spec: {
                        ingressClassName: 'tailscale',
                        tls: [{ hosts: [port.hostname] }],
                        rules: [
                            {
                                host: port.hostname,
                                http: {
                                    paths: [
                                        {
                                            path: '/',
                                            pathType: 'Prefix',
                                            backend: {
                                                service: {
                                                    name: args.service.metadata.name,
                                                    port: { number: port.port },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
                { parent: this.scope },
            );
        });
    }
}
