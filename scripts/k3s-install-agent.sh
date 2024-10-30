#!/bin/bash
set -euo pipefail

# Run this script where Pulumi is configured.
# Copy and execute the output on each Kubernetes agent.

: "${K3S_TOKEN:?Agent token not set}"
: "${K3S_URL:?Server URL not set}"

TS_AUTH_KEY=$(pulumi stack output tailscaleAgentKey --show-secrets)
CLUSTER_DOMAIN=$(pulumi stack output tailscaleDomain)

echo export CLUSTER_DOMAIN=$CLUSTER_DOMAIN
echo export K3S_SELINUX=true
echo export K3S_VPN_AUTH=\"name=tailscale,joinKey=$TS_AUTH_KEY\"
echo export INSTALL_K3S_EXEC='"--docker --node-external-ip=$(tailscale ip -4) --cluster-domain=$CLUSTER_DOMAIN"'
echo export K3S_KUBECONFIG_OUTPUT="~/.kube/config"

echo "curl -sfL https://get.k3s.io | K3S_URL=$K3S_URL K3S_TOKEN=$K3S_TOKEN sh -"
