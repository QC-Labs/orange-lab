import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import * as crypto from 'crypto';

/**
 * This class is used to create a random password for the RPC user and
 * generate the RPC authentication string.
 *
 * Test with:
 * ./scripts/bitcoin-cli.sh -getinfo
 */
export class RpcUser extends pulumi.ComponentResource {
    public username: string;
    public password: pulumi.Output<string>;
    public rpcAuth: pulumi.Output<string>;

    constructor(
        private name: string,
        private readonly args: { username: string },
        opts?: pulumi.ResourceOptions,
    ) {
        super('orangelab:bitcoin:RpcUser', `${name}-${args.username}`, args, opts);
        this.username = args.username;
        this.password = this.createPassword();
        this.rpcAuth = this.createRpcAuth();
    }

    private createPassword() {
        return new random.RandomPassword(
            `${this.name}-${this.args.username}-password`,
            { length: 32, special: false },
            { parent: this },
        ).result;
    }

    private createRpcAuth(): pulumi.Output<string> {
        const salt = new random.RandomString(
            `${this.name}-${this.args.username}-salt`,
            { length: 16, special: false },
            { parent: this },
        ).result;
        const rpcAuth = pulumi.all([this.password, salt]).apply(([password, salt]) => {
            const rpcPasswordHash = crypto
                .createHmac('sha256', salt)
                .update(password)
                .digest('hex');
            return `${this.args.username}:${salt}$${rpcPasswordHash}`;
        });
        return rpcAuth;
    }
}
