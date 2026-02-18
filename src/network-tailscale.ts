import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { config } from './config';
import { Metadata } from './metadata';
import { HttpEndpointInfo, RoutingProvider, ServicePort } from './types';

export class TailscaleNetwork implements RoutingProvider {
    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
        },
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

    createHttpEndpoint(args: {
        serviceName: pulumi.Input<string>;
        port: ServicePort;
        component?: string;
        hostname: string;
    }): pulumi.Resource {
        const httpEndpointInfo = this.getHttpEndpointInfo(args.hostname);
        const metadata = this.args.metadata.get({
            component: args.component
                ? `${args.component}-${args.port.name}`
                : args.port.name,
            annotations: httpEndpointInfo.annotations,
        });
        return new kubernetes.networking.v1.Ingress(
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
