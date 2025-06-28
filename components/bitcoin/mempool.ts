import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { rootConfig } from '../root-config';
import { RpcUser } from './utils/rpc-user';

export interface MempoolArgs {
    electrsUrl: pulumi.Input<string>;
    rpcUser: RpcUser;
    bitcoinRpcUrl: pulumi.Input<string>;
}

export class Mempool extends pulumi.ComponentResource {
    public readonly app: Application;
    private readonly config: pulumi.Config;

    constructor(name: string, private args: MempoolArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:bitcoin:Mempool', name, args, opts);

        rootConfig.require(name, 'mariadb-operator');

        this.config = new pulumi.Config(name);
        this.app = new Application(this, name).addMariaDB();
        if (this.app.storageOnly) return;
        this.createDeployment();
    }

    private createDeployment() {
        const version = this.config.require('version');
        const hostname = this.config.require('hostname');
        const rpcUrl = pulumi
            .output(this.args.bitcoinRpcUrl)
            .apply(url => new URL(`http://${url}`));
        const electrsUrl = pulumi.output(this.args.electrsUrl).apply(url => {
            const [host, port] = url.split(':');
            return { host, port };
        });

        const dbConfig = this.app.databases.getMariaDbConfig();
        this.app
            .addDeployment({
                name: 'backend',
                image: `mempool/backend:${version}`,
                ports: [{ name: 'http', port: 8999, hostname: `${hostname}-backend` }],
                env: {
                    CORE_RPC_HOST: rpcUrl.hostname,
                    CORE_RPC_PORT: rpcUrl.port,
                    DATABASE_DATABASE: dbConfig.database,
                    DATABASE_ENABLED: 'true',
                    DATABASE_HOST: dbConfig.hostname,
                    ELECTRUM_HOST: electrsUrl.host,
                    ELECTRUM_PORT: electrsUrl.port,
                    ELECTRUM_TLS_ENABLED: 'false',
                    MEMPOOL_BACKEND: 'electrum',
                },
                envSecret: {
                    CORE_RPC_USERNAME: this.args.rpcUser.username,
                    CORE_RPC_PASSWORD: this.args.rpcUser.password,
                    DATABASE_PASSWORD: dbConfig.password,
                    DATABASE_USERNAME: dbConfig.username,
                },
                resources: {
                    requests: { cpu: '100m', memory: '512Mi' },
                    limits: { cpu: '1000m', memory: '4Gi' },
                },
            })
            .addDeployment({
                name: 'frontend',
                image: `mempool/frontend:${version}`,
                ports: [{ name: 'http', port: 8080, hostname }],
                env: {
                    FRONTEND_HTTP_PORT: '8080',
                    BACKEND_MAINNET_HTTP_HOST: 'mempool-backend',
                },
                resources: {
                    requests: { cpu: '100m', memory: '512Mi' },
                    limits: { cpu: '1000m', memory: '2Gi' },
                },
            });
    }
}
