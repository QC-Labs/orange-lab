import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';
import { BitcoinConf } from './utils/bitcoin-conf';
import { RpcUser } from './utils/rpc-user';

export interface BitcoinCoreArgs {
    domainName: string;
    rpcUsers: Record<string, RpcUser>;
}

export class BitcoinCore extends pulumi.ComponentResource {
    public readonly app: Application;
    private readonly config: pulumi.Config;
    private readonly prune: number;

    constructor(
        private name: string,
        private args: BitcoinCoreArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:bitcoin:BitcoinCore', name, args, opts);

        this.config = new pulumi.Config(name);
        this.prune = this.config.requireNumber('prune');

        this.app = new Application(this, name, { domainName: args.domainName })
            .addStorage({ type: StorageType.Large })
            .addConfigVolume({
                name: 'config',
                files: {
                    'bitcoin.conf': BitcoinConf.create({ prune: this.prune }),
                    'rpc.conf': BitcoinConf.createRpc(this.args.rpcUsers),
                },
            });

        this.createDeployment();
    }

    private createDeployment() {
        const extraArgs = this.config.get('extraArgs') ?? '';
        const version = this.config.require('version');

        this.app.addDeployment({
            resources: {
                requests: { cpu: '100m', memory: '2Gi' },
                limits: { cpu: '2000m', memory: '8Gi' },
            },
            image: `btcpayserver/bitcoin:${version}`,
            ports: [
                { name: 'rpc', port: 8332, tcp: true },
                { name: 'p2p', port: 8333, tcp: true },
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
        });
    }
}
