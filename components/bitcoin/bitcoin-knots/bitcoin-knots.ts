import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { StorageType } from '@orangelab/types';
import { BitcoinConf } from '../utils/bitcoin-conf';
import { RpcUser } from '../utils/rpc-user';

export interface BitcoinKnotsArgs {
    rpcUsers: Record<string, RpcUser>;
}

export class BitcoinKnots extends pulumi.ComponentResource {
    public readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(
        name: string,
        private args: BitcoinKnotsArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:bitcoin:BitcoinKnots', name, args, opts);

        this.config = new pulumi.Config(name);
        const prune = this.config.requireNumber('prune');
        const debug = this.config.getBoolean('debug');

        this.app = new Application(this, name)
            .addStorage({ type: StorageType.Large })
            .addConfigVolume({
                name: 'config',
                files: {
                    'bitcoin.conf': BitcoinConf.create({ prune, debug }),
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
            image: `btcpayserver/bitcoinknots:${version}`,
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
