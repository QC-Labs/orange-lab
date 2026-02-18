import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { config } from './config';
import { Metadata } from './metadata';
import { HttpEndpointInfo, RoutingProvider, ServicePort } from './types';

export class TraefikNetwork implements RoutingProvider {
    constructor(
        private appName: string,
        private args: {
            metadata: Metadata;
        },
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
                    hostnames: [httpEndpointInfo.hostname],
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
