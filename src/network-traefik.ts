import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { config } from './config';
import { Metadata } from './metadata';
import { HttpEndpointInfo, RoutingProvider, ServicePort } from './types';

export class TraefikNetwork implements RoutingProvider {
    endpoints: Record<string, pulumi.Input<string>> = {};
    clusterEndpoints: Record<string, pulumi.Input<string>> = {};

    constructor(
        private appName: string,
        private args: { metadata: Metadata },
        private opts?: pulumi.ComponentResourceOptions,
    ) {}

    getHttpEndpointInfo(hostname: string): HttpEndpointInfo {
        assert(
            config.customDomain,
            'orangelab:customDomain is required for TraefikNetwork',
        );
        const domain = config.customDomain;
        return {
            className: 'traefik',
            hostname: `${hostname}.${domain}`,
            url: `https://${hostname}.${domain}`,
            tls: true,
            tlsSecretName: `${domain}-tls`,
            domain,
        };
    }

    createHttpEndpoints(args: {
        serviceName: pulumi.Input<string>;
        ports: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        args.ports.forEach(port => {
            const portHostname = port.hostname ?? args.hostname;
            const httpEndpointInfo = this.getHttpEndpointInfo(portHostname);
            const metadata = this.args.metadata.get({
                component: [args.component, port.name].filter(Boolean).join('-'),
            });
            new kubernetes.apiextensions.CustomResource(
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
                        hostnames: [httpEndpointInfo.hostname],
                        rules: [
                            {
                                backendRefs: [
                                    {
                                        name: args.serviceName,
                                        port: port.port,
                                    },
                                ],
                            },
                        ],
                    },
                },
                this.opts,
            );

            const key = this.getFullPortName({ component: args.component, port });
            this.endpoints[key] =
                pulumi.interpolate`https://${httpEndpointInfo.hostname}`;
            this.clusterEndpoints[key] = pulumi.concat(
                'http://',
                pulumi.interpolate`${args.serviceName}.${this.args.metadata.get({ component: args.component }).namespace}:${port.port}`,
            );
        });
    }

    createTcpEndpoints(args: {
        ports: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        if (args.ports.length === 0) return;
        assert(
            config.customDomain,
            'orangelab:customDomain is required for Traefik TCP endpoints',
        );
        const fullHostname = `${args.hostname}.${config.customDomain}`;
        const metadata = this.args.metadata.get({ component: args.component });

        const clusterService = new kubernetes.core.v1.Service(
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

        const tlsPorts = args.ports.filter(p => p.tls);
        const plainPorts = args.ports.filter(p => !p.tls);

        tlsPorts.forEach(port => {
            new kubernetes.apiextensions.CustomResource(
                `${metadata.name}-${port.name}-tlsroute`,
                {
                    apiVersion: 'gateway.networking.k8s.io/v1alpha2',
                    kind: 'TLSRoute',
                    metadata: this.args.metadata.get({
                        component: args.component
                            ? `${args.component}-${port.name}`
                            : port.name,
                    }),
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
                                        name: clusterService.metadata.name,
                                        port: port.port,
                                    },
                                ],
                            },
                        ],
                    },
                },
                { parent: this.opts?.parent },
            );
        });

        if (plainPorts.length > 0) {
            new kubernetes.core.v1.Service(
                `${metadata.name}-lb`,
                {
                    metadata: {
                        ...metadata,
                        name: `${metadata.name}-lb`,
                    },
                    spec: {
                        type: 'LoadBalancer',
                        ports: plainPorts.map(p => ({
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

        args.ports.forEach(port => {
            const key = this.getFullPortName({ component: args.component, port });
            if (port.tls) {
                this.endpoints[key] = pulumi.interpolate`${fullHostname}:3443`;
            } else {
                this.endpoints[key] = pulumi.interpolate`${fullHostname}:${port.port}`;
            }
            this.clusterEndpoints[key] =
                pulumi.interpolate`${clusterService.metadata.name}.${clusterService.metadata.namespace}:${port.port}`;
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
