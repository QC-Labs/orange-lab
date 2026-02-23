import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
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
    ) {
        assert(
            config.tailnetDomain,
            'orangelab:routingProvider=tailscale requires tailscale:tailnet to be set',
        );
        assert(
            config.isEnabled('tailscale'),
            `${this.appName}: Tailscale Operator has to be installed (tailscale:enabled=true)`,
        );
    }

    getHttpEndpointInfo(hostname: string): HttpEndpointInfo {
        return {
            className: 'tailscale',
            hostname,
            url: `https://${hostname}.${config.tailnetDomain}`,
            tls: true,
            domain: config.tailnetDomain,
        };
    }

    createHttpEndpoints(params: {
        serviceName: pulumi.Input<string>;
        httpPorts: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        params.httpPorts.forEach(httpPort => {
            const httpEndpointInfo = this.getHttpEndpointInfo(
                httpPort.hostname ?? params.hostname,
            );
            const componentName = [params.component, httpPort.name]
                .filter(Boolean)
                .join('-');

            this.createIngress({
                componentName,
                httpEndpointInfo,
                serviceName: params.serviceName,
                servicePort: httpPort,
            });

            const key = this.getEndpointKey({
                component: params.component,
                portName: httpPort.name,
            });
            this.endpoints[key] =
                pulumi.interpolate`https://${httpEndpointInfo.hostname}`;
            this.clusterEndpoints[key] =
                pulumi.interpolate`http://${params.serviceName}.${this.args.metadata.namespace}:${httpPort.port}`;
        });
    }

    private createIngress(params: {
        componentName: string;
        httpEndpointInfo: HttpEndpointInfo;
        serviceName: pulumi.Input<string>;
        servicePort: ServicePort;
    }): void {
        const metadata = this.args.metadata.get({ component: params.componentName });
        new kubernetes.networking.v1.Ingress(
            `${metadata.name}-ingress`,
            {
                metadata,
                spec: {
                    ingressClassName: params.httpEndpointInfo.className,
                    tls: [
                        {
                            hosts: [params.httpEndpointInfo.hostname],
                            secretName: params.httpEndpointInfo.tlsSecretName,
                        },
                    ],
                    rules: [
                        {
                            host: params.httpEndpointInfo.hostname,
                            http: {
                                paths: [
                                    {
                                        path: '/',
                                        pathType: 'Prefix',
                                        backend: {
                                            service: {
                                                name: params.serviceName,
                                                port: { number: params.servicePort.port },
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

    createTcpEndpoints(params: {
        tcpPorts: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        if (params.tcpPorts.length === 0) return;

        const service = this.createTcpLoadBalancer({
            component: params.component,
            tcpPorts: params.tcpPorts,
            hostname: params.hostname,
        });

        params.tcpPorts.forEach(port => {
            const key = this.getEndpointKey({
                component: params.component,
                portName: port.name,
            });
            this.endpoints[key] = pulumi.interpolate`${params.hostname}:${port.port}`;
            this.clusterEndpoints[key] =
                pulumi.interpolate`${service.metadata.name}.${service.metadata.namespace}:${port.port}`;
        });
    }

    private createTcpLoadBalancer(params: {
        component: string | undefined;
        tcpPorts: ServicePort[];
        hostname: string;
    }): kubernetes.core.v1.Service {
        const metadata = this.args.metadata.get({ component: params.component });
        return new kubernetes.core.v1.Service(
            `${metadata.name}-ts-lb`,
            {
                metadata: {
                    ...metadata,
                    annotations: { 'tailscale.com/hostname': params.hostname },
                },
                spec: {
                    type: 'LoadBalancer',
                    loadBalancerClass: 'tailscale',
                    ports: params.tcpPorts.map(p => ({
                        name: p.name,
                        protocol: 'TCP',
                        port: p.port,
                        targetPort: p.port,
                    })),
                    selector: this.args.metadata.getSelectorLabels(params.component),
                },
            },
            {
                ...this.opts,
                aliases: [{ name: `${metadata.name}-lb` }],
            },
        );
    }

    private getEndpointKey(params: {
        component: string | undefined;
        portName: string;
    }): string {
        return [
            this.appName,
            params.component,
            params.portName === 'http' ? undefined : params.portName,
        ]
            .filter(Boolean)
            .join('-');
    }
}
