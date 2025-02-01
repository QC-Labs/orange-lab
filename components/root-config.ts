import * as pulumi from '@pulumi/pulumi';

class RootConfig {
    private globalConfig = new pulumi.Config('orangelab');

    public isEnabled(name: string): boolean {
        const config = new pulumi.Config(name);
        return (
            this.globalConfig.getBoolean(name) ?? config.getBoolean('enabled') ?? false
        );
    }

    public get(key: string): string | undefined {
        return this.globalConfig.get(key);
    }
}

export const rootConfig = new RootConfig();
