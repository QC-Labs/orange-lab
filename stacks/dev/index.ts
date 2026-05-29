import { config } from '@orangelab/pulumi';
import { Debug } from './components/debug/debug';

if (config.isEnabled('debug')) {
    new Debug('debug');
}
