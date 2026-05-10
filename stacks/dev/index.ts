import { config } from '@orangelab/pulumi';
import { Debug } from './apps/debug/debug';

if (config.isEnabled('debug')) {
    new Debug('debug');
}
