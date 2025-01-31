import * as pulumi from '@pulumi/pulumi';

class RootConfig {
    private globalConfig = new pulumi.Config('orangelab');

    public isEnabled(name: string): boolean {
        const config = new pulumi.Config(name);
        return (
            this.globalConfig.getBoolean(name) ?? config.getBoolean('enabled') ?? false
        );
    }
}

export const rootConfig = new RootConfig();
