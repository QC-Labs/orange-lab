import * as pulumi from '@pulumi/pulumi';
import { config } from './config';
import { coreStack } from './core-stack';

export const OidcProvider = {
    Pocket: 'pocket',
} as const;

export interface OidcAuthConfig {
    providerBaseUrl?: pulumi.Input<string | undefined>;
    providerUrl?: pulumi.Input<string | undefined>;
    clientId: string;
    clientSecret: pulumi.Output<string>;
}

export class Auth {
    constructor(private readonly appName: string) {}

    getOidc(): OidcAuthConfig | undefined {
        if (config.get(this.appName, 'auth') !== OidcProvider.Pocket) return undefined;

        return {
            providerBaseUrl: coreStack.outputs.security?.apply(
                security => security?.oidcProviderBaseUrl,
            ),
            providerUrl:
                config.get(this.appName, 'auth/providerUrl') ??
                coreStack.outputs.security?.apply(security => security?.oidcProviderUrl),
            clientId: config.require(this.appName, 'auth/clientId'),
            clientSecret: config.requireSecret(this.appName, 'auth/clientSecret'),
        };
    }
}
