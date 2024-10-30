#!/bin/bash
set -euo pipefail

# Run this script on Kubernetes server.
# Copy and execute the output on each Kubernetes agent.

echo export K3S_TOKEN=$(sudo cat /var/lib/rancher/k3s/server/node-token)
echo export K3S_URL=https://$(tailscale ip -4):6443
