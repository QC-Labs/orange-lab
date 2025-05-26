import * as pulumi from '@pulumi/pulumi';

import { RpcUser } from './rpc-user';

function createRpc(rpcUsers: Record<string, RpcUser>): pulumi.Output<string> {
    const authLines = Object.values(rpcUsers).map(
        user => pulumi.interpolate`rpcauth=${user.rpcAuth}`,
    );
    return pulumi.all(authLines).apply(lines => lines.join('\n'));
}

function create({ prune }: { prune: number }): pulumi.Output<string> {
    return pulumi.interpolate`
${prune > 0 ? `prune=${prune.toString()}` : 'txindex=1'}
blocksonly=0
debug=all
debugexclude=addrman
debugexclude=bench
debugexclude=leveldb
debugexclude=libevent
debugexclude=mempool
debugexclude=net
debugexclude=txpackages
debugexclude=validation
disablewallet=1
listen=0
listenonion=0
maxconnections=15
nodebuglogfile=1
printtoconsole=1
rest=0
rpcallowip=0.0.0.0/0
rpcbind=0.0.0.0
server=1

# OP_RETURN filtering
datacarrier=1
datacarriersize=83
`;
}

export const BitcoinConf = {
    createRpc,
    create,
};
