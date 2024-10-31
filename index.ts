import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './components/longhorn';
import { Tailscale } from './components/tailscale';
import { Prometheus } from './components/prometheus';

const orangelabConfig = new pulumi.Config('orangelab');

const tailscale = new Tailscale('tailscale');

let longhorn;
if (orangelabConfig.requireBoolean('longhorn')) {
    longhorn = new Longhorn('longhorn');
}

if (orangelabConfig.requireBoolean('prometheus')) {
    new Prometheus('prometheus', {}, { dependsOn: longhorn });
}

export const tailscaleServerKey = tailscale.serverKey;
export const tailscaleAgentKey = tailscale.agentKey;
export const tailscaleDomain = tailscale.tailnet;
export const orangelab = orangelabConfig;
