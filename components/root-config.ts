import * as pulumi from '@pulumi/pulumi';

class RootConfig {
    private config = new pulumi.Config('orangelab');

    public isEnabled(name: string): boolean {
        return this.config.requireBoolean(name);
    }
}

export const rootConfig = new RootConfig();
