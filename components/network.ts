import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Metadata } from './metadata';
import { ContainerSpec, ServicePort } from './types';

export class Network {
    readonly endpoints: Record<string, pulumi.Output<string> | string> = {};
    readonly clusterEndpoints: Record<string, pulumi.Output<string> | string> = {};

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
        this.createHttpEndpoints(httpPorts, spec);

        const tcpPorts = ports.filter(p => p.tcp);
        this.createTcpEndpoints(tcpPorts, spec.name);
    }

    private createTcpEndpoints(tcpPorts: ServicePort[], component?: string) {
        if (tcpPorts.length === 0) return;
        const hostname = this.config.require('hostname');
        const service = this.createLoadBalancer({
            hostname,
            ports: tcpPorts,
            component,
        });
        tcpPorts.forEach(port => {
            this.exportEndpoint({ component, port });
            this.exportClusterEndpoint({ component, port, service });
        });
    }

    private createHttpEndpoints(httpPorts: ServicePort[], spec: ContainerSpec) {
        if (httpPorts.length === 0) return;
        const service = this.createService({
            component: spec.name,
            ports: httpPorts,
        });
        httpPorts.forEach(port => {
            this.createIngress({ service, port, component: spec.name });
            this.exportEndpoint({ component: spec.name, port });
            this.exportClusterEndpoint({ component: spec.name, port, service });
        });
    }

    private exportEndpoint(args: { component?: string; port: ServicePort }) {
        const key = this.getFullPortName({ component: args.component, port: args.port });
        const hostname = args.port.hostname ?? this.config.get('hostname');
        const url = args.port.tcp
            ? pulumi.interpolate`${hostname}:${args.port.port}`
            : pulumi.interpolate`https://${hostname}.${this.domainName}`;
        this.endpoints[key] = url;
    }

    private exportClusterEndpoint(args: {
        component?: string;
        port: ServicePort;
        service: kubernetes.core.v1.Service;
    }) {
        const key = this.getFullPortName({ component: args.component, port: args.port });
        const url = pulumi.interpolate`${args.service.metadata.name}.${args.service.metadata.namespace}:${args.port.port}`;
        this.clusterEndpoints[key] = args.port.tcp ? url : pulumi.concat('http://', url);
    }

    private getFullPortName(args: { component?: string; port: ServicePort }): string {
        const key = [
            this.appName,
            args.component,
            args.port.name === 'http' ? undefined : args.port.name,
        ]
            .filter(Boolean)
            .join('-');
        return key;
    }

    private createService(args: {
        component?: string;
        ports: ServicePort[];
    }): kubernetes.core.v1.Service {
        const metadata = this.metadata.get({ component: args.component });
        return new kubernetes.core.v1.Service(
            `${metadata.name}-svc`,
            {
                metadata,
                spec: {
                    type: 'ClusterIP',
                    ports: args.ports.map(p => ({
                        name: p.name,
                        protocol: 'TCP',
                        port: p.port,
                        targetPort: p.port,
                    })),
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
    }): kubernetes.core.v1.Service {
        const metadata = this.metadata.get({ component: args.component });
        return new kubernetes.core.v1.Service(
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
        port: ServicePort;
        component?: string;
    }): kubernetes.networking.v1.Ingress {
        assert(this.domainName, 'domainName is required for ingress');
        assert(args.port.hostname, `hostname is required for port ${args.port.name}`);
        const componentName = args.component
            ? `${args.component}-${args.port.name}`
            : args.port.name;
        const metadata = this.metadata.get({ component: componentName });
        return new kubernetes.networking.v1.Ingress(
            `${metadata.name}-ingress`,
            {
                metadata,
                spec: {
                    ingressClassName: 'tailscale',
                    tls: [{ hosts: [args.port.hostname] }],
                    rules: [
                        {
                            host: args.port.hostname,
                            http: {
                                paths: [
                                    {
                                        path: '/',
                                        pathType: 'Prefix',
                                        backend: {
                                            service: {
                                                name: args.service.metadata.name,
                                                port: { number: args.port.port },
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
    }
}
