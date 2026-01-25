import * as pulumi from '@pulumi/pulumi';
import { Application } from '@orangelab/application';
import { config } from '@orangelab/config';
import { StorageType } from '@orangelab/types';
import { BitcoinConf } from '../utils/bitcoin-conf';
import { RpcUser } from '../utils/rpc-user';

export interface BitcoinKnotsArgs {
    rpcUsers: Record<string, RpcUser>;
}

export class BitcoinKnots extends pulumi.ComponentResource {
    public readonly app: Application;

    constructor(
        private readonly name: string,
        private args: BitcoinKnotsArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:bitcoin:BitcoinKnots', name, args, opts);

        const prune = config.requireNumber(name, 'prune');
        const debug = config.getBoolean(name, 'debug');

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
        const extraArgs = config.get(this.name, 'extraArgs') ?? '';
        const version = config.require(this.name, 'version');

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
