#!/bin/bash
set -euo pipefail

# Run this script where Pulumi is configured.
# Copy and execute the output on Kubernetes server.

TS_AUTH_KEY=$(pulumi stack output tailscaleServerKey --show-secrets)
CLUSTER_DOMAIN=$(pulumi stack output tailscaleDomain)

echo export CLUSTER_DOMAIN=$CLUSTER_DOMAIN
echo export NODE_IP='$(tailscale ip -4)'
echo export INSTALL_K3S_EXEC='"--docker --node-external-ip=$NODE_IP --cluster-domain=$CLUSTER_DOMAIN"'
echo export K3S_SELINUX=true
echo export K3S_VPN_AUTH=\"name=tailscale,joinKey=$TS_AUTH_KEY\"
echo export K3S_KUBECONFIG_OUTPUT="~/.kube/config"

echo "curl -sfL https://get.k3s.io |  sh -"
