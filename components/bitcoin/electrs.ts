import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { StorageType } from '../types';
import { RpcUser } from './utils/rpc-user';

export interface ElectrsArgs {
    domainName: string;
    rpcUser: RpcUser;
    bitcoinRpcUrl: string;
    bitcoinP2pUrl: string;
}

export class Electrs extends pulumi.ComponentResource {
    public readonly rpcUrl?: string;
    public readonly rpcClusterUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(name: string, private args: ElectrsArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:bitcoin:Electrs', name, args, opts);

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');
        const debug = this.config.getBoolean('debug');
        const rpcAddr = new URL(this.args.bitcoinRpcUrl);

        this.app = new Application(this, name, {
            domainName: args.domainName,
        })
            .addStorage({ type: StorageType.Large })
            .addConfigVolume({
                name: 'config',
                files: {
                    'electrs.toml': pulumi.interpolate`
                        auth = "${this.args.rpcUser.username}:${
                        this.args.rpcUser.password
                    }"
                        daemon_rpc_addr = "${rpcAddr.host}"
                        daemon_p2p_addr = "${this.args.bitcoinP2pUrl}"
                        db_dir = "/data"
                        electrum_rpc_addr = "0.0.0.0:50001"
                        log_filters = ${debug ? '"DEBUG"' : '"INFO"'}
                    `,
                },
            });

        if (this.app.storageOnly) return;

        this.createDeployment();

        this.rpcUrl = `${hostname}.${args.domainName}`;
        this.rpcClusterUrl = `${hostname}.${this.app.namespace}:50001`;
    }

    private createDeployment() {
        if (!this.args.bitcoinRpcUrl || !this.args.bitcoinP2pUrl) return;
        const version = this.config.require('version');
        const hostname = this.config.require('hostname');
        const extraArgs = this.config.get('extraArgs') ?? '';

        this.app.addDeployment({
            image: `getumbrel/electrs:${version}`,
            ports: [{ name: 'rpc', port: 50001, hostname, tcp: true }],
            runAsUser: 1000,
            commandArgs: ['--conf=/conf/electrs.toml', extraArgs],
            volumeMounts: [
                { mountPath: '/data' },
                { name: 'config', mountPath: '/conf' },
            ],
            resources: {
                requests: { cpu: '100m', memory: '8Gi' },
                limits: { cpu: '2000m', memory: '16Gi' },
            },
        });
    }
}
