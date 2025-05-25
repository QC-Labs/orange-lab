import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';
import { BitcoinConf } from './utils/bitcoin-conf';
import { RpcUser } from './utils/rpc-user';

const RPC_PORT = 8332;

export interface BitcoinKnotsArgs {
    domainName: string;
    rpcUsers: Record<string, RpcUser>;
}

export class BitcoinKnots extends pulumi.ComponentResource {
    public readonly endpointUrl?: string;
    public readonly serviceUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(
        name: string,
        private args: BitcoinKnotsArgs,
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:bitcoin:BitcoinKnots', name, args, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');
        const prune = this.config.requireNumber('prune');

        this.app = new Application(this, name, {
            domainName: args.domainName,
        })
            .addStorage({ type: StorageType.Large })
            .addConfigVolume({
                files: {
                    'bitcoin.conf': BitcoinConf.create({ prune }),
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
            image: `btcpayserver/bitcoinknots:${this.config.require('version')}`,
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
