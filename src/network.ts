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
        const ports = spec.ports ?? [];
        if (ports.length === 0) return;

        const service = this.createClusterService({
            component: spec.name,
            ports,
        });
        this.exportClusterEndpoints({ service, component: spec.name, ports });

        const publicPorts = ports.filter(p => !p.private);
        const httpPorts = publicPorts.filter(p => !p.tcp);
        if (httpPorts.length > 0) {
            this.provider.createHttpEndpoints({
                serviceName: service.metadata.name,
                httpPorts,
                component: spec.name,
                hostname: this.getHostname(spec.name),
            });
        }
        const tcpPorts = publicPorts.filter(p => p.tcp);
        if (tcpPorts.length > 0) {
            this.provider.createTcpEndpoints({
                serviceName: service.metadata.name,
                tcpPorts,
                component: spec.name,
                hostname: this.getHostname(spec.name),
            });
        }

        Object.assign(this.endpoints, this.provider.endpoints);
    }

    private getHostname(component?: string) {
        return component
            ? config.require(this.appName, `${component}/hostname`)
            : config.require(this.appName, 'hostname');
    }

    private createClusterService(args: {
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
                        protocol: p.udp ? 'UDP' : 'TCP',
                        port: p.port,
                        targetPort: p.port,
                    })),
                    selector: this.args.metadata.getSelectorLabels(args.component),
                },
            },
            this.opts,
        );
    }

    private exportClusterEndpoints(params: {
        service: kubernetes.core.v1.Service;
        component?: string;
        ports: ServicePort[];
    }): void {
        params.ports.forEach(port => {
            const key = this.getEndpointKey({
                component: params.component,
                portName: port.name,
            });
            const prefix = port.tcp ? '' : 'http://';
            this.clusterEndpoints[key] =
                pulumi.interpolate`${prefix}${params.service.metadata.name}.${this.args.metadata.namespace}:${port.port}`;
        });
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
