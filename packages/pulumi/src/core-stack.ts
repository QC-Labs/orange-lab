import * as pulumi from '@pulumi/pulumi';
import { config } from './config';
import { CoreStackExports } from './types';

/**
 * Wraps a StackReference pointing at the core (orangelab) stack so module
 * stacks can consume non-secret outputs without duplicating config. Reads
 * `orangelab:coreStackRef` — the fully-qualified stack name in
 * `organization/project/stack` form (e.g. `example-org/orangelab/lab`).
 * No-op when the key is unset, so module stacks remain independently
 * deployable. Exposed as the `coreStack` singleton so all components in a
 * stack share one StackReference.
 */
export class CoreStack {
    private readonly ref?: pulumi.StackReference;
    readonly outputs: {
        config?: pulumi.Output<CoreStackExports['config']>;
        security?: pulumi.Output<CoreStackExports['security']>;
    };

    constructor() {
        const name = config.get('orangelab', 'coreStackRef');
        this.ref = name ? new pulumi.StackReference('core', { name }) : undefined;
        this.outputs = {
            config: this.ref
                ? (this.ref.getOutput('config') as pulumi.Output<
                      CoreStackExports['config']
                  >)
                : undefined,
            security: this.ref
                ? (this.ref.getOutput('security') as pulumi.Output<
                      CoreStackExports['security']
                  >)
                : undefined,
        };
    }
}

export const coreStack = new CoreStack();
