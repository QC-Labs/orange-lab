import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { config } from './config';
import { Metadata } from './metadata';
import { TailscaleNetwork } from './network-tailscale';
import { TraefikNetwork } from './network-traefik';
import { ContainerSpec, HttpEndpointInfo, RoutingProvider, ServicePort } from './types';

export class Network {
    endpoints: Record<string, pulumi.Input<string>> = {};
    clusterEndpoints: Record<string, pulumi.Input<string>> = {};
    private provider: RoutingProvider;

    constructor(
        private appName: string,
        private args: { metadata: Metadata },
        private opts?: pulumi.ComponentResourceOptions,
    ) {
        const routingProvider =
            config.get(this.appName, 'routingProvider') ?? config.routingProvider;
        switch (routingProvider) {
            case 'traefik':
                this.provider = new TraefikNetwork(appName, args, opts);
                break;
            case 'tailscale':
                this.provider = new TailscaleNetwork(appName, args, opts);
                break;
            default:
                throw new Error(
                    `Unknown routingProvider: ${routingProvider}. Must be 'traefik' or 'tailscale'.`,
                );
        }
    }

    public getHttpEndpointInfo(
        hostname: string = config.require(this.appName, 'hostname'),
    ): HttpEndpointInfo {
        return this.provider.getHttpEndpointInfo(hostname);
    }

    createEndpoints(spec: ContainerSpec) {
        const hostname = config.require(this.appName, 'hostname');
        const ports = spec.ports ?? [];
        const httpPorts = ports.filter(p => !p.tcp);
        this.createHttpEndpoints(httpPorts, spec);
        const tcpPorts = ports.filter(p => p.tcp);
        this.provider.createTcpEndpoints({
            tcpPorts,
            component: spec.name,
            hostname,
        });
        Object.assign(this.endpoints, this.provider.endpoints);
        Object.assign(this.clusterEndpoints, this.provider.clusterEndpoints);
    }

    private createHttpEndpoints(httpPorts: ServicePort[], spec: ContainerSpec) {
        if (httpPorts.length === 0) return;
        const service = this.createHttpService({
            component: spec.name,
            ports: httpPorts,
        });
        const publicHttpPorts = httpPorts.filter(p => !p.private);
        if (publicHttpPorts.length > 0) {
            this.provider.createHttpEndpoints({
                serviceName: service.metadata.name,
                httpPorts: publicHttpPorts,
                component: spec.name,
                hostname: config.require(this.appName, 'hostname'),
            });
        }
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
}
