import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Metadata } from './metadata';
import { rootConfig } from './root-config';
import { ContainerSpec, ServicePort } from './types';

export interface IngressInfo {
    className: string;
    hostname: string;
    url: string;
    tls: boolean;
    domain: string;
}

export class Network {
    readonly endpoints: Record<string, pulumi.Output<string> | string> = {};
    readonly clusterEndpoints: Record<string, pulumi.Output<string> | string> = {};

    private readonly config: pulumi.Config;
    private readonly metadata: Metadata;

    constructor(
        private readonly appName: string,
        args: {
            readonly config: pulumi.Config;
            readonly metadata: Metadata;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        this.config = args.config;
        this.metadata = args.metadata;
    }

    createEndpoints(spec: ContainerSpec) {
        const hostname = this.config.get('hostname');
        if (!hostname) return;
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
            const ingressInfo = this.getIngressInfo(port.hostname, port.ingressClassName);
            this.createIngress({
                serviceName: service.metadata.name,
                port,
                component: spec.name,
                ingressInfo,
            });
            this.exportEndpoint({ component: spec.name, port });
            this.exportClusterEndpoint({ component: spec.name, port, service });
        });
    }

    private exportEndpoint(args: { component?: string; port: ServicePort }) {
        const domainName = rootConfig.customDomain ?? rootConfig.tailnetDomain;
        assert(
            domainName,
            'tailscale:tailnetDomain or orangelab:customDomain is required',
        );
        const protocol = rootConfig.customDomain ? 'http' : 'https';
        const hostname = args.port.hostname ?? this.config.get('hostname');
        const url = args.port.tcp
            ? pulumi.interpolate`${hostname}:${args.port.port}`
            : pulumi.interpolate`${protocol}://${hostname}.${domainName}`;
        const key = this.getFullPortName({ component: args.component, port: args.port });
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
            this.opts,
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
            this.opts,
        );
    }

    public getIngressInfo(
        hostname: string = this.config.require('hostname'),
        className?: 'tailscale' | 'traefik',
    ): IngressInfo {
        if (className === 'tailscale' || !rootConfig.customDomain) {
            return {
                className: 'tailscale',
                hostname,
                url: `https://${hostname}.${rootConfig.tailnetDomain}`,
                tls: true,
                domain: rootConfig.tailnetDomain,
            };
        } else {
            return {
                className: 'traefik',
                hostname: `${hostname}.${rootConfig.customDomain}`,
                url: `http://${hostname}.${rootConfig.customDomain}`,
                tls: false,
                domain: rootConfig.customDomain,
            };
        }
    }

    private createIngress(args: {
        serviceName: pulumi.Input<string>;
        port: ServicePort;
        component?: string;
        ingressInfo: IngressInfo;
    }): kubernetes.networking.v1.Ingress {
        const componentName = args.component
            ? `${args.component}-${args.port.name}`
            : args.port.name;
        const metadata = this.metadata.get({ component: componentName });
        return new kubernetes.networking.v1.Ingress(
            `${metadata.name}-ingress`,
            {
                metadata,
                spec: {
                    ingressClassName: args.ingressInfo.className,
                    tls: [{ hosts: [args.ingressInfo.hostname] }],
                    rules: [
                        {
                            host: args.ingressInfo.hostname,
                            http: {
                                paths: [
                                    {
                                        path: '/',
                                        pathType: 'Prefix',
                                        backend: {
                                            service: {
                                                name: args.serviceName,
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
            {
                ...this.opts,
                aliases: [
                    { name: `${metadata.name}-ingress` },
                    { name: `${metadata.name}-traefik-ingress` },
                ],
            },
        );
    }
}
