import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { config } from './config';
import { Metadata } from './metadata';
import { HttpEndpointInfo, RoutingProvider, ServicePort } from './types';

export class TailscaleNetwork implements RoutingProvider {
    endpoints: Record<string, pulumi.Input<string>> = {};
    clusterEndpoints: Record<string, pulumi.Input<string>> = {};

    constructor(
        private appName: string,
        private args: { metadata: Metadata },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    getHttpEndpointInfo(hostname: string): HttpEndpointInfo {
        return {
            className: 'tailscale',
            hostname,
            url: `https://${hostname}.${config.tailnetDomain}`,
            tls: true,
            domain: config.tailnetDomain,
        };
    }

    createHttpEndpoints(args: {
        serviceName: pulumi.Input<string>;
        ports: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        args.ports.forEach(port => {
            const httpEndpointInfo = this.getHttpEndpointInfo(
                port.hostname ?? args.hostname,
            );
            const metadata = this.args.metadata.get({
                component: [args.component, port.name].filter(Boolean).join('-'),
            });
            new kubernetes.networking.v1.Ingress(
                `${metadata.name}-ingress`,
                {
                    metadata,
                    spec: {
                        ingressClassName: httpEndpointInfo.className,
                        tls: [
                            {
                                hosts: [httpEndpointInfo.hostname],
                                secretName: httpEndpointInfo.tlsSecretName,
                            },
                        ],
                        rules: [
                            {
                                host: httpEndpointInfo.hostname,
                                http: {
                                    paths: [
                                        {
                                            path: '/',
                                            pathType: 'Prefix',
                                            backend: {
                                                service: {
                                                    name: args.serviceName,
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
                {
                    ...this.opts,
                    aliases: [
                        { name: `${metadata.name}-ingress` },
                        { name: `${metadata.name}-traefik-ingress` },
                    ],
                },
            );

            const key = this.getFullPortName({ component: args.component, port });
            this.endpoints[key] =
                pulumi.interpolate`https://${httpEndpointInfo.hostname}`;
            this.clusterEndpoints[key] = pulumi.concat(
                'http://',
                pulumi.interpolate`${args.serviceName}.${metadata.namespace}:${port.port}`,
            );
        });
    }

    createTcpEndpoints(args: {
        ports: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        if (args.ports.length === 0) return;
        const metadata = this.args.metadata.get({ component: args.component });
        const service = new kubernetes.core.v1.Service(
            `${metadata.name}-ts-lb`,
            {
                metadata: {
                    ...metadata,
                    name: `${metadata.name}-ts-lb`,
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
                    selector: this.args.metadata.getSelectorLabels(args.component),
                },
            },
            {
                ...this.opts,
                aliases: [{ name: `${metadata.name}-lb` }],
            },
        );

        args.ports.forEach(port => {
            const key = this.getFullPortName({ component: args.component, port });
            this.endpoints[key] = pulumi.interpolate`${args.hostname}:${port.port}`;
            this.clusterEndpoints[key] =
                pulumi.interpolate`${service.metadata.name}.${service.metadata.namespace}:${port.port}`;
        });
    }

    private getFullPortName(args: { component?: string; port: ServicePort }): string {
        return [
            this.appName,
            args.component,
            args.port.name === 'http' ? undefined : args.port.name,
        ]
            .filter(Boolean)
            .join('-');
    }
}
