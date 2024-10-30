import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './components/longhorn';
import { Tailscale } from './components/tailscale';

const config = new pulumi.Config('orangelab');
const enabled: Record<string, boolean> = config.requireObject('modules');

let tailscale;
if (enabled.tailscale) {
    tailscale = new Tailscale('tailscale');
}

if (enabled.longhorn) {
    new Longhorn('longhorn', config.requireObject('longhorn'));
}

export const tailscaleServerKey = tailscale?.serverKey;
export const tailscaleAgentKey = tailscale?.agentKey;
export const tailscaleDomain = tailscale?.tailnet;
