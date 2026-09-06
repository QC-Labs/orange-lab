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

export interface OidcProviderUrls {
    providerBaseUrl?: pulumi.Input<string | undefined>;
    providerUrl?: pulumi.Input<string | undefined>;
}

export class Auth {
    constructor(private readonly appName: string) {}

    getOidc(local?: OidcProviderUrls): OidcAuthConfig | undefined {
        if (config.get(this.appName, 'auth') !== OidcProvider.Pocket) return undefined;

        return {
            providerBaseUrl:
                local?.providerBaseUrl ??
                coreStack.outputs.security?.apply(
                    security => security?.oidcProviderBaseUrl,
                ),
            providerUrl:
                config.get(this.appName, 'auth/providerUrl') ??
                local?.providerUrl ??
                coreStack.outputs.security?.apply(security => security?.oidcProviderUrl),
            clientId: config.require(this.appName, 'auth/clientId'),
            clientSecret: config.requireSecret(this.appName, 'auth/clientSecret'),
        };
    }
}
