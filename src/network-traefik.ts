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
    ) {
        assert(
            config.customDomain,
            'orangelab:routingProvider=traefik requires orangelab:customDomain to be set',
        );
        assert(
            config.isEnabled('traefik'),
            `${this.appName}: Traefik has to be installed (traefik:enabled=true)`,
        );
    }

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

    createHttpEndpoints(params: {
        serviceName: pulumi.Input<string>;
        httpPorts: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        params.httpPorts.forEach(portSpec => {
            const portHostname = portSpec.hostname ?? params.hostname;
            const httpEndpointInfo = this.getHttpEndpointInfo(portHostname);
            const portComponentName = [params.component, portSpec.name]
                .filter(Boolean)
                .join('-');

            this.createHttpRoute({
                hostname: httpEndpointInfo.hostname,
                componentName: portComponentName,
                serviceName: params.serviceName,
                servicePort: portSpec.port,
            });

            const key = this.getEndpointKey({
                component: params.component,
                portName: portSpec.name,
            });
            this.endpoints[key] =
                pulumi.interpolate`https://${httpEndpointInfo.hostname}`;
            this.clusterEndpoints[key] =
                pulumi.interpolate`http://${params.serviceName}.${this.args.metadata.namespace}:${portSpec.port}`;
        });
    }

    private createHttpRoute(params: {
        hostname: string;
        componentName: string;
        serviceName: pulumi.Input<string>;
        servicePort: number;
    }): void {
        const metadata = this.args.metadata.get({ component: params.componentName });
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
                    hostnames: [params.hostname],
                    rules: [
                        {
                            backendRefs: [
                                {
                                    name: params.serviceName,
                                    port: params.servicePort,
                                },
                            ],
                        },
                    ],
                },
            },
            this.opts,
        );
    }

    createTcpEndpoints(params: {
        tcpPorts: ServicePort[];
        component?: string;
        hostname: string;
    }): void {
        if (params.tcpPorts.length === 0) return;
        assert(
            config.customDomain,
            'orangelab:customDomain is required for Traefik TCP endpoints',
        );

        const service = this.createTcpService({
            component: params.component,
            servicePorts: params.tcpPorts,
        });
        const fullHostname = `${params.hostname}.${config.customDomain}`;
        this.createTlsRoutes({
            component: params.component,
            tlsPorts: params.tcpPorts,
            service,
            fullHostname,
        });
        this.createInternalLoadBalancer({
            component: params.component,
            servicePorts: params.tcpPorts,
        });

        params.tcpPorts.forEach(port => {
            const key = this.getEndpointKey({
                component: params.component,
                portName: port.name,
            });
            this.endpoints[key] = port.tls
                ? pulumi.interpolate`${fullHostname}:3443`
                : pulumi.interpolate`${fullHostname}:${port.port}`;
            this.clusterEndpoints[key] =
                pulumi.interpolate`${service.metadata.name}.${service.metadata.namespace}:${port.port}`;
        });
    }

    private createTcpService(params: {
        component?: string;
        servicePorts: ServicePort[];
    }): kubernetes.core.v1.Service {
        const metadata = this.args.metadata.get({ component: params.component });
        return new kubernetes.core.v1.Service(
            `${metadata.name}-svc`,
            {
                metadata,
                spec: {
                    type: 'ClusterIP',
                    ports: params.servicePorts.map(p => ({
                        name: p.name,
                        protocol: 'TCP',
                        port: p.port,
                        targetPort: p.port,
                    })),
                    selector: this.args.metadata.getSelectorLabels(params.component),
                },
            },
            this.opts,
        );
    }

    private createTlsRoutes(params: {
        component?: string;
        tlsPorts: ServicePort[];
        service: kubernetes.core.v1.Service;
        fullHostname: string;
    }): void {
        const metadata = this.args.metadata.get({ component: params.component });
        params.tlsPorts
            .filter(p => p.tls)
            .forEach(port => {
                new kubernetes.apiextensions.CustomResource(
                    `${metadata.name}-${port.name}-tlsroute`,
                    {
                        apiVersion: 'gateway.networking.k8s.io/v1alpha2',
                        kind: 'TLSRoute',
                        metadata: this.args.metadata.get({
                            component: params.component
                                ? `${params.component}-${port.name}`
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
                            hostnames: [params.fullHostname],
                            rules: [
                                {
                                    backendRefs: [
                                        {
                                            name: params.service.metadata.name,
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
    }

    private createInternalLoadBalancer(params: {
        component: string | undefined;
        servicePorts: ServicePort[];
    }): void {
        const metadata = this.args.metadata.get({ component: params.component });
        const plainPorts = params.servicePorts.filter(p => !p.tls);
        if (plainPorts.length === 0) return;

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
                    selector: this.args.metadata.getSelectorLabels(params.component),
                },
            },
            this.opts,
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
