/* eslint-disable sort-keys */
import { Mempool } from './mempool';
import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { BitcoinCore } from './bitcoin-core';
import { BitcoinKnots } from './bitcoin-knots';
import { Electrs } from './electrs';
import { RpcUser } from './utils/rpc-user';
import assert from 'assert';

interface BitcoinModuleArgs {
    domainName: string;
}

export class BitcoinModule extends pulumi.ComponentResource {
    private readonly bitcoinKnots?: BitcoinKnots;
    private readonly bitcoinCore?: BitcoinCore;
    private readonly electrs?: Electrs;
    private readonly mempool?: Mempool;

    /**
     * Map of username to password
     */
    bitcoinUsers: Record<string, pulumi.Output<string>> = {};

    getExports() {
        return {
            bitcoinUsers: Object.fromEntries(
                Object.entries(this.bitcoinUsers).map(([user, password]) => [
                    user,
                    pulumi.secret(password),
                ]),
            ),
            endpoints: {
                ...this.bitcoinCore?.app.network.endpoints,
                ...this.bitcoinKnots?.app.network.endpoints,
                ...this.electrs?.app.network.endpoints,
                ...this.mempool?.app.network.endpoints,
            },
            clusterEndpoints: {
                ...this.bitcoinCore?.app.network.clusterEndpoints,
                ...this.bitcoinKnots?.app.network.clusterEndpoints,
                ...this.electrs?.app.network.clusterEndpoints,
                ...this.mempool?.app.network.clusterEndpoints,
            },
        };
    }

    constructor(
        name: string,
        args: BitcoinModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:bitcoin', name, args, opts);

        const config = new pulumi.Config('bitcoin');
        const usernames = config
            .require('rpcUsers')
            .split(',')
            .map(u => u.trim());
        const rpcUsers: Record<string, RpcUser> = {};
        usernames.forEach(username => {
            rpcUsers[username] = new RpcUser(name, { username }, { parent: this });
            this.bitcoinUsers[username] = rpcUsers[username].password;
        });

        if (rootConfig.isEnabled('bitcoin-knots')) {
            this.bitcoinKnots = new BitcoinKnots(
                'bitcoin-knots',
                { domainName: args.domainName, rpcUsers },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('bitcoin-core')) {
            this.bitcoinCore = new BitcoinCore(
                'bitcoin-core',
                { domainName: args.domainName, rpcUsers },
                { parent: this },
            );
        }

        const bitcoinRpcUrl =
            this.bitcoinKnots?.app.network.clusterEndpoints['bitcoin-knots-rpc'] ??
            this.bitcoinCore?.app.network.clusterEndpoints['bitcoin-core-rpc'];
        const bitcoinP2pUrl =
            this.bitcoinKnots?.app.network.clusterEndpoints['bitcoin-knots-p2p'] ??
            this.bitcoinCore?.app.network.clusterEndpoints['bitcoin-core-p2p'];
        if (rootConfig.isEnabled('electrs')) {
            assert(
                bitcoinRpcUrl && bitcoinP2pUrl,
                'Bitcoin node must be enabled for Electrs',
            );
            this.electrs = new Electrs(
                'electrs',
                {
                    domainName: args.domainName,
                    rpcUser: rpcUsers.electrs,
                    bitcoinRpcUrl,
                    bitcoinP2pUrl,
                },
                { parent: this },
            );
        }

        if (rootConfig.isEnabled('mempool')) {
            const electrsUrl = this.electrs?.app.network.clusterEndpoints['electrs-rpc'];
            assert(electrsUrl, 'Electrs must be enabled for Mempool');
            assert(bitcoinRpcUrl, 'Bitcoin RPC must be enabled for Mempool');
            this.mempool = new Mempool(
                'mempool',
                {
                    domainName: args.domainName,
                    electrsUrl,
                    rpcUser: rpcUsers.mempool,
                    bitcoinRpcUrl,
                },
                { parent: this },
            );
        }
    }
}
