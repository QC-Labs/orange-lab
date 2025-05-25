import * as pulumi from '@pulumi/pulumi';
import { rootConfig } from '../root-config';
import { BitcoinCore } from './bitcoin-core';
import { BitcoinKnots } from './bitcoin-knots';
import { RpcUser } from './utils/rpc-user';

interface BitcoinModuleArgs {
    domainName: string;
}

export class BitcoinModule extends pulumi.ComponentResource {
    bitcoinKnots?: BitcoinKnots;
    bitcoinCore?: BitcoinCore;
    /**
     * Map of username to password
     */
    bitcoinUsers: Record<string, pulumi.Output<string>> = {};

    constructor(
        name: string,
        args: BitcoinModuleArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('orangelab:bitcoin', name, args, opts);

        const usernames = ['admin', 'electrs'];
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
    }
}
