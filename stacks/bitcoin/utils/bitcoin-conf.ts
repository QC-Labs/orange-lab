import * as pulumi from '@pulumi/pulumi';

import { RpcUser } from './rpc-user';

function createRpc(rpcUsers: Record<string, RpcUser>): pulumi.Output<string> {
    const authLines = Object.values(rpcUsers).map(
        user => pulumi.interpolate`${user.rpcAuth}`,
    );
    return pulumi.all(authLines).apply(lines => lines.join('\n'));
}

function create({
    prune,
    debug,
    debugExclude,
    externalIp,
    maxConnections,
}: {
    prune: number;
    debug?: boolean;
    debugExclude: string;
    externalIp?: string;
    maxConnections: number;
}): string {
    const debugExcludeLines = debugExclude
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => `debugexclude=${value}`)
        .join('\n');

    return `
${prune > 0 ? `prune=${prune.toString()}` : 'txindex=1'}
${externalIp ? `externalip=${externalIp}` : ''}
${debug ? 'debug=all' : ''}
${debugExcludeLines}
disablewallet=1
listen=1
listenonion=0
maxconnections=${maxConnections.toString()}
nodebuglogfile=1
printtoconsole=1
rpcallowip=0.0.0.0/0
rpcbind=0.0.0.0
server=1
rpcauthfile=/conf/rpc.conf
`;
}

export const BitcoinConf = {
    createRpc,
    create,
};
