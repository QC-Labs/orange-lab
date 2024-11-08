import * as pulumi from '@pulumi/pulumi';
import { Longhorn } from './components/longhorn';
import { Prometheus } from './components/prometheus';
import { Tailscale } from './components/tailscale';
import { TailscaleOperator } from './components/tailscale-operator';
import { HomeAssistant } from './components/home-assistant';

const config = new pulumi.Config('orangelab');
const configK3s = new pulumi.Config('k3s');

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

if (config.requireBoolean('home-assistant')) {
    new HomeAssistant('homeassistant', {
        trustedProxies: [
            configK3s.require('clusterCidr'),
            configK3s.require('serviceCidr'),
            '127.0.0.0/8',
        ],
    });
}

export const tailscaleServerKey = tailscale.serverKey;
export const tailscaleAgentKey = tailscale.agentKey;
export const tailscaleDomain = tailscale.tailnet;
