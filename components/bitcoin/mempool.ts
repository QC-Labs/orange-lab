import * as pulumi from '@pulumi/pulumi';
import { Application } from '../application';
import { RpcUser } from './utils/rpc-user';

export interface MempoolArgs {
    domainName: string;
    electrsUrl: string;
    rpcUser: RpcUser;
    bitcoinRpcUrl: string;
}

export class Mempool extends pulumi.ComponentResource {
    public readonly frontendUrl?: string;

    private readonly app: Application;
    private readonly config: pulumi.Config;
    private readonly electrsHost: string;
    private readonly electrsPort: string;

    constructor(name: string, private args: MempoolArgs, opts?: pulumi.ResourceOptions) {
        super('orangelab:bitcoin:Mempool', name, args, opts);

        const [host, port] = args.electrsUrl.split(':');
        this.electrsHost = host;
        this.electrsPort = port;

        this.config = new pulumi.Config(name);
        const hostname = this.config.require('hostname');

        this.app = new Application(this, name, {
            domainName: args.domainName,
        });

        this.createDeployment();
        this.frontendUrl = `${hostname}.${args.domainName}`;
    }

    private createDeployment() {
        const version = this.config.require('version');
        const hostname = this.config.require('hostname');
        const rpcUrl = new URL(this.args.bitcoinRpcUrl);

        this.app
            .addDeployment({
                name: 'backend',
                image: `mempool/backend:${version}`,
                ports: [{ name: 'http', port: 8999, hostname: `${hostname}-backend` }],
                env: {
                    MEMPOOL_BACKEND: 'electrum',
                    ELECTRUM_HOST: this.electrsHost,
                    ELECTRUM_PORT: this.electrsPort,
                    ELECTRUM_TLS_ENABLED: 'false',
                    DATABASE_ENABLED: 'false',
                    CORE_RPC_HOST: rpcUrl.hostname,
                    CORE_RPC_PORT: rpcUrl.port,
                },
                envSecret: {
                    CORE_RPC_USERNAME: this.args.rpcUser.username,
                    CORE_RPC_PASSWORD: this.args.rpcUser.password,
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
