import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';
import { BitcoinConf } from './utils/bitcoin-conf';
import { RpcUser } from './utils/rpc-user';

const RPC_PORT = 8332;

export interface BitcoinCoreArgs {
    domainName: string;
    rpcUsers: Record<string, RpcUser>;
}

export class BitcoinCore extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;
    private readonly prune: number;

    constructor(
        private name: string,
        private args: BitcoinCoreArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:bitcoin:BitcoinCore', name, args, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');
        this.prune = this.config.requireNumber('prune');

        this.app = new Application(this, name, { domainName: args.domainName })
            .addStorage({ type: StorageType.Large })
            .addConfigVolume({
                files: {
                    'bitcoin.conf': BitcoinConf.create({ prune: this.prune }),
                    'rpc.conf': BitcoinConf.createRpc(this.args.rpcUsers),
                },
            });

        if (this.app.storageOnly) return;

        this.createDeployment();

        this.endpointUrl = `${hostname}.${args.domainName}:${RPC_PORT.toString()}`;
        this.serviceUrl = `${name}.${this.app.namespace}:${RPC_PORT.toString()}`;
    }

    private createDeployment() {
        const extraArgs = this.config.get('extraArgs') ?? '';

        this.app.addDeployment({
            resources: {
                requests: { cpu: '100m', memory: '3Gi' },
                limits: { cpu: '2000m', memory: '8Gi' },
            },
            image: `btcpayserver/bitcoin:${this.config.require('version')}`,
            ports: [
                {
                    name: 'rpc',
                    port: RPC_PORT,
                    hostname: this.config.require('hostname'),
                    tcp: true,
                },
            ],
            commandArgs: ['bitcoind', extraArgs],
            env: {
                BITCOIN_EXTRA_ARGS: [
                    'includeconf=/conf/bitcoin.conf',
                    'includeconf=/conf/rpc.conf',
                ].join('\n'),
            },
            volumeMounts: [
                { mountPath: '/data' },
                { name: 'config', mountPath: '/conf' },
            ],
            healthChecks: false,
        });
    }
}
