// dagger-workflow.ts (updated)
import { connect } from '@dagger.io/dagger';

interface WorkflowOptions {
    operation: 'preview' | 'deploy';
    nodeVersion?: string;
}

async function runStep<T>(step: Promise<T>): Promise<{ result?: T; error?: string }> {
    try {
        return { result: await step };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}

export default async function main(
    opts: WorkflowOptions = {
        operation: 'preview',
        nodeVersion: '20',
    },
) {
    await connect(async client => {
        const npmCache = client.cacheVolume('orange-npm-cache');
        const node = client
            .container()
            .from(`node:20`)
            .withMountedDirectory('/src', client.host().directory('.'))
            .withMountedCache('/root/.npm', npmCache)
            .withWorkdir('/src');

        // Run critical dependency install first
        const deps = await runStep(node.withExec(['npm', 'ci']).stdout());

        // Run lint/test in parallel with error handling
        const [lint, test] = await Promise.all([
            runStep(node.withExec(['npm', 'run', 'lint']).stdout()),
            runStep(node.withExec(['npm', 'run', 'test']).stdout()),
        ]);

        // Always show results
        console.log({ deps, lint, test });

        // Run deployment steps if requested
        if (opts.operation === 'deploy') {
            const deploy = await runStep(
                node.withExec(['npx', 'pulumi', 'up', '--yes', '--refresh']).stdout(),
            );
            console.log({ deploy });
        } else {
            const preview = await runStep(
                node.withExec(['npx', 'pulumi', 'preview', '--diff']).stdout(),
            );
            console.log({ preview });
        }

        // Exit with error code if critical failures occurred
        if (deps.error || (opts.operation === 'deploy' && deploy?.error)) {
            process.exit(1);
        }
    });
}

// Parse CLI arguments
const args = process.argv.slice(2);
const operation = args.includes('--deploy') ? 'deploy' : 'preview';
void main({ operation });
