import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './components/longhorn';
import { Prometheus } from './components/prometheus';
import { Tailscale } from './components/tailscale';
import { TailscaleOperator } from './components/tailscale-operator';

const config = new pulumi.Config('orangelab');

const tailscale = new Tailscale('tailscale');

if (config.requireBoolean('tailscale-operator')) {
    new TailscaleOperator('tailscale-operator');
}

let longhorn;
if (config.requireBoolean('longhorn')) {
    longhorn = new Longhorn('longhorn');
}

if (config.requireBoolean('prometheus')) {
    new Prometheus('prometheus', {}, { dependsOn: longhorn });
}

export const tailscaleServerKey = tailscale.serverKey;
export const tailscaleAgentKey = tailscale.agentKey;
export const tailscaleDomain = tailscale.tailnet;
