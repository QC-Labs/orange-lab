#!/bin/bash
set -euo pipefail

# Run this script where Pulumi is configured.
# Copy and execute the output on each Kubernetes agent.

K3S_URL=https://$(pulumi config get k3s:serverIp):6443
K3S_TOKEN=$(pulumi config get k3s:agentToken)
TS_AUTH_KEY=$(pulumi stack output system --show-secrets | jq .tailscaleAgentKey -r)

echo export K3S_URL=$K3S_URL
echo export NODE_IP='$(tailscale ip -4)'
echo export K3S_TOKEN=$K3S_TOKEN
echo export TS_AUTH_KEY=$TS_AUTH_KEY

echo "curl -sfL https://get.k3s.io |  sh -s - \
--server \$K3S_URL \
--token \$K3S_TOKEN \
--bind-address=\$NODE_IP \
--selinux \
--vpn-auth \"name=tailscale,joinKey=\$TS_AUTH_KEY\""
