import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import assert from 'node:assert';
import { Metadata } from './metadata';
import { ContainerSpec } from './containers';

export interface ServicePort {
    name: string;
    port: number;
    hostname?: string;
}

export class Network {
    serviceUrl?: string;
    endpointUrl?: string;

    private readonly config: pulumi.Config;
    private readonly metadata: Metadata;
    private readonly scope: pulumi.ComponentResource;
    private readonly domainName?: string;

    constructor(
        private readonly appName: string,
        args: {
            readonly scope: pulumi.ComponentResource;
            readonly config: pulumi.Config;
            readonly metadata: Metadata;
            readonly domainName?: string;
        },
    ) {
        this.config = args.config;
        this.metadata = args.metadata;
        this.scope = args.scope;
        this.domainName = args.domainName;
    }

    createEndpoints(spec: ContainerSpec) {
        const hostname = this.config.get('hostname');
        if (!hostname) return;
        assert(this.domainName, 'domainName is required');
        const metadata = this.metadata.get();
        assert(metadata.namespace, 'namespace is required');

        const ports: ServicePort[] = [
            ...(spec.port ? [{ name: 'http', port: spec.port, hostname }] : []),
            ...(spec.ports ?? []),
        ];
        if (ports.length === 0) return;

        const service = this.createService(ports);
        this.createIngress(service, ports);
        const port = ports[0].port.toString();
        this.serviceUrl = `http://${hostname}.${metadata.namespace}:${port}`;
        this.endpointUrl = `https://${hostname}.${this.domainName}`;
    }

    private createService(ports: ServicePort[]): kubernetes.core.v1.Service {
        const servicePorts = ports.map(p => ({
            name: p.name,
            protocol: 'TCP',
            port: p.port,
            targetPort: p.port,
        }));

        return new kubernetes.core.v1.Service(
            `${this.appName}-svc`,
            {
                metadata: this.metadata.get(),
                spec: {
                    type: 'ClusterIP',
                    ports: servicePorts,
                    selector: this.metadata.getSelectorLabels(),
                },
            },
            { parent: this.scope },
        );
    }

    private createIngress(
        service: kubernetes.core.v1.Service,
        ports: ServicePort[],
    ): kubernetes.networking.v1.Ingress[] {
        assert(this.domainName, 'domainName is required for ingress');

        return ports.map((p, i) => {
            assert(p.hostname, `hostname is required for port ${p.name}`);
            const componentName = i === 0 ? this.appName : `${this.appName}-${p.name}`;
            return new kubernetes.networking.v1.Ingress(
                `${componentName}-ingress`,
                {
                    metadata: {
                        ...(i === 0
                            ? this.metadata.get()
                            : this.metadata.getForComponent(p.name)),
                    },
                    spec: {
                        ingressClassName: 'tailscale',
                        tls: [{ hosts: [p.hostname] }],
                        rules: [
                            {
                                host: p.hostname,
                                http: {
                                    paths: [
                                        {
                                            path: '/',
                                            pathType: 'Prefix',
                                            backend: {
                                                service: {
                                                    name: service.metadata.name,
                                                    port: { number: p.port },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
                { parent: this.scope },
            );
        });
    }
}
