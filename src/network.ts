import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { config } from './config';
import { Metadata } from './metadata';
import { ContainerSpec, ServicePort } from './types';

export interface HttpEndpointInfo {
    className: string;
    hostname: string;
    url: string;
    tls: boolean;
    tlsSecretName?: string;
    domain: string;
    annotations?: Record<string, pulumi.Input<string>>;
}

export class Network {
    endpoints: Record<string, pulumi.Input<string>> = {};
    clusterEndpoints: Record<string, pulumi.Input<string>> = {};

    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
        },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    createEndpoints(spec: ContainerSpec) {
        const hostname = config.get(this.appName, 'hostname');
        if (!hostname) return;
        const metadata = this.args.metadata.get({ component: spec.name });
        assert(metadata.namespace, 'namespace is required');

        const ports: ServicePort[] = [
            ...(spec.port ? [{ name: 'http', port: spec.port, hostname }] : []),
            ...(spec.ports ?? []),
        ];
        if (ports.length === 0) return;

        const httpPorts = ports.filter(p => !p.tcp);
        this.createHttpEndpoints(httpPorts, spec);

        if (config.customDomain) {
            const tcpPorts = ports.filter(p => p.tcp && !p.tls);
            this.createTcpEndpoints(tcpPorts, spec.name);
            const tlsPorts = ports.filter(p => p.tcp && p.tls);
            this.createTlsEndpoints(tlsPorts, spec.name);
        } else {
            const tcpPorts = ports.filter(p => p.tcp);
            this.createTcpEndpoints(tcpPorts, spec.name);
        }
    }

    private createTlsEndpoints(ports: ServicePort[], component?: string) {
        if (ports.length === 0 || !config.customDomain) return;
        const service = this.createService({ component, ports });
        ports.forEach(port => {
            if (config.customDomain) {
                this.createTlsRoute({
                    component,
                    port,
                    serviceName: service.metadata.name,
                });
            }
        });
        ports.forEach(port => {
            this.exportEndpoint({ component, port });
            this.exportClusterEndpoint({ component, port, service });
        });
    }

    private createTcpEndpoints(tcpPorts: ServicePort[], component?: string) {
        if (tcpPorts.length === 0) return;
        const hostname = config.require(this.appName, 'hostname');
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

    private createService(args: {
        component?: string;
        ports: ServicePort[];
    }): kubernetes.core.v1.Service {
        const metadata = this.args.metadata.get({ component: args.component });
        return new kubernetes.core.v1.Service(
            `${metadata.name}-svc`,
            {
                metadata: { ...metadata, name: metadata.name },
                spec: {
                    type: 'ClusterIP',
                    ports: args.ports.map(p => ({
                        name: p.name,
                        protocol: 'TCP',
                        port: p.port,
                        targetPort: p.port,
                    })),
                    selector: this.args.metadata.getSelectorLabels(args.component),
                },
            },
            this.opts,
        );
    }

    private createTlsRoute(args: {
        component?: string;
        port: ServicePort;
        serviceName: pulumi.Input<string>;
    }): void {
        const hostname = args.port.hostname ?? config.get(this.appName, 'hostname');
        if (!hostname || !config.customDomain) return;

        const fullHostname = `${hostname}.${config.customDomain}`;
        const metadata = this.args.metadata.get({
            component: args.component
                ? `${args.component}-${args.port.name}`
                : args.port.name,
        });

        new kubernetes.apiextensions.CustomResource(
            `${metadata.name}-tlsroute`,
            {
                apiVersion: 'gateway.networking.k8s.io/v1alpha2',
                kind: 'TLSRoute',
                metadata,
                spec: {
                    parentRefs: [
                        {
                            name: 'traefik-gateway',
                            namespace: 'traefik',
                            sectionName: 'tls',
                        },
                    ],
                    hostnames: [fullHostname],
                    rules: [
                        {
                            backendRefs: [
                                {
                                    name: args.serviceName,
                                    port: args.port.port,
                                },
                            ],
                        },
                    ],
                },
            },
            { parent: this.opts?.parent },
        );
    }

    private createHttpEndpoints(httpPorts: ServicePort[], spec: ContainerSpec) {
        if (httpPorts.length === 0) return;
        const service = this.createHttpService({
            component: spec.name,
            ports: httpPorts,
        });
        httpPorts.forEach(port => {
            const httpEndpointInfo = this.getHttpEndpointInfo(port.hostname);
            if (httpEndpointInfo.className === 'traefik') {
                this.createHttpRoute({
                    serviceName: service.metadata.name,
                    port,
                    component: spec.name,
                    httpEndpointInfo,
                });
            } else {
                this.createIngress({
                    serviceName: service.metadata.name,
                    port,
                    component: spec.name,
                    httpEndpointInfo,
                });
            }
            this.exportEndpoint({ component: spec.name, port });
            this.exportClusterEndpoint({ component: spec.name, port, service });
        });
    }

    private exportEndpoint(args: { component?: string; port: ServicePort }) {
        const domainName = config.customDomain ?? config.tailnetDomain;
        assert(
            domainName,
            'tailscale:tailnetDomain or orangelab:customDomain is required',
        );
        const hostname = args.port.hostname ?? config.get(this.appName, 'hostname');
        const key = this.getFullPortName({ component: args.component, port: args.port });
        if (args.port.tcp && args.port.tls) {
            const tlsUrl = pulumi.interpolate`${hostname}.${domainName}:3443`;
            this.endpoints[`${key}-tls`] = tlsUrl;
        } else {
            const url = args.port.tcp
                ? pulumi.interpolate`${hostname}:${args.port.port}`
                : pulumi.interpolate`https://${hostname}.${domainName}`;
            this.endpoints[key] = url;
        }
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

    private createHttpService(args: {
        component?: string;
        ports: ServicePort[];
    }): kubernetes.core.v1.Service {
        const metadata = this.args.metadata.get({ component: args.component });
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
                    selector: this.args.metadata.getSelectorLabels(args.component),
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
        const metadata = this.args.metadata.get({ component: args.component });
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
                    selector: this.args.metadata.getSelectorLabels(),
                },
            },
            this.opts,
        );
    }

    public getHttpEndpointInfo(
        hostname: string = config.require(this.appName, 'hostname'),
    ): HttpEndpointInfo {
        if (!config.customDomain) {
            return {
                className: 'tailscale',
                hostname,
                url: `https://${hostname}.${config.tailnetDomain}`,
                tls: true,
                domain: config.tailnetDomain,
            };
        } else {
            return {
                className: 'traefik',
                hostname: `${hostname}.${config.customDomain}`,
                url: `https://${hostname}.${config.customDomain}`,
                tls: true,
                tlsSecretName: `${config.customDomain}-tls`,
                domain: config.customDomain,
            };
        }
    }

    private createIngress(args: {
        serviceName: pulumi.Input<string>;
        port: ServicePort;
        component?: string;
        httpEndpointInfo: HttpEndpointInfo;
    }): kubernetes.networking.v1.Ingress {
        const metadata = this.args.metadata.get({
            component: args.component
                ? `${args.component}-${args.port.name}`
                : args.port.name,
            annotations: args.httpEndpointInfo.annotations,
        });
        return new kubernetes.networking.v1.Ingress(
            `${metadata.name}-ingress`,
            {
                metadata,
                spec: {
                    ingressClassName: args.httpEndpointInfo.className,
                    tls: [
                        {
                            hosts: [args.httpEndpointInfo.hostname],
                            secretName: args.httpEndpointInfo.tlsSecretName,
                        },
                    ],
                    rules: [
                        {
                            host: args.httpEndpointInfo.hostname,
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

    private createHttpRoute(args: {
        serviceName: pulumi.Input<string>;
        port: ServicePort;
        component?: string;
        httpEndpointInfo: HttpEndpointInfo;
    }): kubernetes.apiextensions.CustomResource {
        const metadata = this.args.metadata.get({
            component: args.component
                ? `${args.component}-${args.port.name}`
                : args.port.name,
            annotations: args.httpEndpointInfo.annotations,
        });
        return new kubernetes.apiextensions.CustomResource(
            `${metadata.name}-httproute`,
            {
                apiVersion: 'gateway.networking.k8s.io/v1',
                kind: 'HTTPRoute',
                metadata,
                spec: {
                    parentRefs: [
                        {
                            name: 'traefik-gateway',
                            namespace: 'traefik',
                            sectionName: 'websecure',
                        },
                    ],
                    hostnames: [args.httpEndpointInfo.hostname],
                    rules: [
                        {
                            backendRefs: [
                                {
                                    name: args.serviceName,
                                    port: args.port.port,
                                },
                            ],
                        },
                    ],
                },
            },
            this.opts,
        );
    }
}
