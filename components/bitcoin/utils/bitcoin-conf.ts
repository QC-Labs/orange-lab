import * as pulumi from '@pulumi/pulumi';

import { RpcUser } from './rpc-user';

function createRpc(rpcUsers: Record<string, RpcUser>): pulumi.Output<string> {
    const authLines = Object.values(rpcUsers).map(
        user => pulumi.interpolate`rpcauth=${user.rpcAuth}`,
    );
    return pulumi.all(authLines).apply(lines => lines.join('\n'));
}

function create({ prune }: { prune: number }): string {
    return `
${prune > 0 ? `prune=${prune.toString()}` : 'txindex=1'}
blocksonly=0
debug=all
debugexclude=addrman
debugexclude=bench
debugexclude=estimatefee
debugexclude=leveldb
debugexclude=libevent
debugexclude=mempool
debugexclude=net
debugexclude=txpackages
debugexclude=validation
disablewallet=1
listen=1
listenonion=0
maxconnections=20
nodebuglogfile=1
printtoconsole=1
rest=0
rpcallowip=0.0.0.0/0
rpcbind=0.0.0.0
server=1
`;
}

export const BitcoinConf = {
    createRpc,
    create,
};
