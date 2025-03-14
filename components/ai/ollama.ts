import * as kubernetes from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { PersistentStorageType } from '../persistent-storage';

export interface OllamaArgs {
    domainName: string;
}

export class Ollama extends pulumi.ComponentResource {
    public readonly endpointUrl: string | undefined;
    public readonly serviceUrl: string | undefined;
    app: Application;

    constructor(private name: string, args: OllamaArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:ai:Ollama', name, args, opts);

        const config = new pulumi.Config(name);
        const version = config.get('version');
        const hostname = config.require('hostname');

        this.app = new Application(this, name, { domainName: args.domainName })
            .addDefaultLimits({ request: { cpu: '5m', memory: '3Gi' } })
            .addStorage({ type: PersistentStorageType.GPU });

        if (this.app.storageOnly) return;

        this.createHelmRelease(hostname, version);

        this.endpointUrl = `https://${hostname}.${args.domainName}`;
        this.serviceUrl = `http://${hostname}.ollama:11434`;
    }

    private createHelmRelease(hostname: string, version?: string) {
        new kubernetes.helm.v3.Release(
            this.name,
            {
                chart: 'ollama',
                namespace: this.app.namespaceName,
                version,
                repositoryOpts: { repo: 'https://otwld.github.io/ollama-helm/' },
                values: {
                    affinity: this.app.nodes.getAffinity(),
                    fullnameOverride: 'ollama',
                    securityContext: { privileged: true },
                    nodeSelector: { 'orangelab/gpu': 'true' },
                    runtimeClassName: 'nvidia',
                    extraEnv: [{ name: 'OLLAMA_DEBUG', value: 'false' }],
                    ollama: {
                        gpu: {
                            enabled: true,
                            type: 'nvidia',
                            number: 1,
                        },
                        models: { pull: [] },
                    },
                    persistentVolume: {
                        enabled: true,
                        existingClaim: this.app.volumes.getClaimName(),
                    },
                    ingress: {
                        enabled: true,
                        className: 'tailscale',
                        hosts: [
                            {
                                host: hostname,
                                paths: [{ path: '/', pathType: 'Prefix' }],
                            },
                        ],
                        tls: [{ hosts: [hostname] }],
                    },
                },
            },
            { parent: this },
        );
    }
}
