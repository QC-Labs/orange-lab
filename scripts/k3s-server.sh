#!/bin/bash
set -euo pipefail

# Run this script where Pulumi is configured.
# Copy and execute the output on Kubernetes server.

TS_AUTH_KEY=$(pulumi stack output tailscaleServerKey --show-secrets)
CLUSTER_DOMAIN=$(pulumi stack output tailscaleDomain)

echo export NODE_IP='$(tailscale ip -4)'

echo "curl -sfL https://get.k3s.io |  sh -s - \
--bind-address=\$NODE_IP \
--selinux \
--docker \
--secrets-encryption \
--vpn-auth \"name=tailscale,joinKey=$TS_AUTH_KEY\" \
--disable=local-storage \
--disable=servicelb \
--disable=traefik \
--write-kubeconfig ~/.kube/config \
--write-kubeconfig-mode=644"
