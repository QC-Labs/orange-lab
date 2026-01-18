# Installation - system applications

Core components required before any other apps can de deployed.

The first time you configure the cluster, it's best to run `pulumi up` after each component. Make sure all pods are running fine before moving to next step.

**Tailscale operator** used for internal HTTPS endpoints.

**Longhorn** required for storage nodes but only runs on Linux. You can use local storage when using MacOS, Windows or when running [single node](../../docs/single-node.md) only.

**MinIO** is used by Longhorn and required for automatic backups.

To run GPU workloads, either **NVidia or AMD operator** has to be installed.

**NFD** is used for automatic detection of nodes with GPU hardware.

**Cert-manager** is used to create SSL certificates when using custom domain and Traefik.

Recommended setup/tldr:

```sh
# Add k8s and k8s-operator tags to Tailscale ACL
# Create OAuth client in Tailscale
pulumi config set tailscale-operator:oauthClientId <OAUTH_CLIENT_ID> --secret
pulumi config set tailscale-operator:oauthClientSecret <OAUTH_CLIENT_SECRET> --secret
pulumi config set tailscale-operator:enabled true
pulumi up

# Add tag to storage nodes that will be used by Longhorn
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true
pulumi config set longhorn:enabled true
pulumi up

# Enable NFD for automatic GPU detection
pulumi config set nfd:enabled true
# Enable NVIDIA GPUs driver
pulumi config set nvidia-gpu-operator:enabled true
# Enable AMD GPUs driver
pulumi config set amd-gpu-operator:enabled true
pulumi up
```

## Custom domains

By default Tailscale domain (`*.ts.net`) is used for all services.

You can also setup your custom domain.

Note that Tailscale authentication does not work on custom domains.

You need to:

- add A record to your DNS pointing `*` (or each subdomain separately) to one of your Tailscale node IPs
- configure `cert-manager` to use `ClusterIssuer` to provision Let's Encrypt SSL certificates
- set `orangelab:customDomain` to the name of your domain

ServiceLB creates an endpoint on port 80/443 on each node in the cluster.

This could create issues if the ports are already used outside of OrangeLab. If you want to limit on which nodes the load balancer is created, label the nodes. Adding the first label switches ServiceLB to white-list only mode.

```sh
kubectl label node <node> svccontroller.k3s.cattle.io/enablelb=true
```

**Note:** When switching from Tailscale to a custom domain, you **must** disable `longhorn:backupEnabled` first. The MinIO Pulumi provider connection will break during the transition because the API endpoint hostname changes.

```sh
# Disable backups
# This will keep the S3 bucket contents intact
pulumi config set longhorn:backupEnabled false
pulumi up

# Enable custom domain, this will also install Traefik
pulumi config set orangelab:customDomain example.com
pulumi up

# Re-enable backups
pulumi config set longhorn:backupEnabled true
pulumi up
```

## Components

- [Tailscale Operator](./tailscale/tailscale.md) - Manages cluster ingress endpoints and Kubernetes API access.
- [Traefik](./traefik/traefik.md) - Edge router and ingress controller for custom domain traffic.
- [Longhorn](./longhorn/longhorn.md) - Replicated block storage for Kubernetes workloads.
- [Minio](./minio/minio.md) - S3-compatible object storage for backups and data.
- [Cert-manager](./cert-manager/cert-manager.md) - Automated certificate management for custom domains.
- [NFD](./nfd/nfd.md) - Node Feature Discovery for hardware-aware scheduling.
- [NVIDIA GPU Operator](./nvidia-gpu-operator/nvidia-gpu-operator.md) - Enables NVIDIA GPU support for containerized workloads.
- [AMD GPU Operator](./amd-gpu-operator/amd-gpu-operator.md) - Enables AMD GPU support for ROCm workloads.
- [Debug](./debug/debug.md) - Troubleshooting utilities and volume access tools.
