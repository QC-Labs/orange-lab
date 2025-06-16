#!/bin/bash
set -euo pipefail

# Run this script where Pulumi is configured.
# Copy and execute the output on Kubernetes server.

CLUSTER_CIDR=$(pulumi config get k3s:clusterCidr)
SERVICE_CIDR=$(pulumi config get k3s:serviceCidr)
TS_AUTH_KEY=$(pulumi stack output system --show-secrets | jq .tailscaleServerKey -r)

echo export NODE_IP='$(tailscale ip -4)'
echo export CLUSTER_CIDR=$CLUSTER_CIDR
echo export SERVICE_CIDR=$SERVICE_CIDR
echo export TS_AUTH_KEY=$TS_AUTH_KEY
echo
echo "curl -sfL https://get.k3s.io |  sh -s - \
--bind-address=\$NODE_IP \
--selinux \
--secrets-encryption \
--vpn-auth \"name=tailscale,joinKey=\$TS_AUTH_KEY\" \
--cluster-cidr=\$CLUSTER_CIDR \
--service-cidr=\$SERVICE_CIDR \
--disable=servicelb \
--disable=traefik \
--kube-apiserver-arg=enable-admission-plugins=DefaultTolerationSeconds \
--kube-apiserver-arg=default-not-ready-toleration-seconds=10 \
--kube-apiserver-arg=default-unreachable-toleration-seconds=10"
echo
echo systemctl enable k3s.service --now
