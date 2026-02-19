# Installation - system applications

Core components required before any other apps can be deployed.

The first time you configure the cluster, it's best to run `pulumi up` after each component. Make sure all pods are running fine before moving to next step.

## Network

Choose how external traffic reaches your services:

- **[Tailscale](./tailscale/tailscale.md)** - Uses Tailscale's `.ts.net` domain with built-in HTTPS and authentication
- **[Traefik](./traefik/traefik.md)** - Uses your custom domain with automatic TLS certificates

**Cert-manager** is used to create SSL certificates when using custom domain and Traefik.

```sh
# Tailscale (default)
pulumi config set orangelab:routingProvider tailscale
pulumi config set tailscale:tailnet <tailnet>.ts.net
pulumi config set tailscale:enabled true
pulumi up

# Custom domain
pulumi config set orangelab:routingProvider traefik
pulumi config set orangelab:customDomain example.com
pulumi config set cert-manager:enabled true
pulumi config set traefik:enabled true
pulumi up
```

Note: Tailscale authentication does not work on custom domains. TCP routes use k3s ServiceLB instead of Tailscale LoadBalancer when using Traefik.

### ServiceLB

When using Traefik, k3s ServiceLB creates endpoints on port 80/443 on each node. This could create issues if these ports are already in use outside of OrangeLab. To limit which nodes run the load balancer:

```sh
kubectl label node <node> svccontroller.k3s.cattle.io/enablelb=true
```

Adding the first label switches ServiceLB to whitelist-only mode.

## Storage

**[Longhorn](./longhorn/longhorn.md)** - Required for storage nodes. Only runs on Linux; use local storage for MacOS/Windows or [single node](/docs/single-node.md).

```sh
kubectl label nodes <node-name> node-role.kubernetes.io/longhorn=true
pulumi config set longhorn:enabled true
pulumi up
```

**[RustFS](./rustfs/rustfs.md)** - S3-compatible object storage used by Longhorn for automatic backups.

## GPU

To run GPU workloads:

- **[NFD](./nfd/nfd.md)** - Automatic detection of nodes with GPU hardware
- **[NVIDIA GPU Operator](./nvidia-gpu-operator/nvidia-gpu-operator.md)** - Enables NVIDIA GPU support
- **[AMD GPU Operator](./amd-gpu-operator/amd-gpu-operator.md)** - Enables AMD GPU support

```sh
# GPU auto-detection
pulumi config set nfd:enabled true

# NVidia
pulumi config set nvidia-gpu-operator:enabled true

# AMD
pulumi config set amd-gpu-operator true
pulumi up
```

## Components

- [Tailscale Operator](./tailscale/tailscale.md) - Manages cluster ingress endpoints and Kubernetes API access.
- [Traefik](./traefik/traefik.md) - Ingress controller for custom domain traffic.
- [Longhorn](./longhorn/longhorn.md) - Replicated block storage for Kubernetes workloads.
- [Rustfs](./rustfs/rustfs.md) - S3-compatible object storage for Longhorn backups.
- [Cert-manager](./cert-manager/cert-manager.md) - Automated certificate management for custom domains.
- [NFD](./nfd/nfd.md) - Node Feature Discovery for hardware-aware scheduling and GPU auto-detection.
- [NVIDIA GPU Operator](./nvidia-gpu-operator/nvidia-gpu-operator.md) - (Optional) Enables NVIDIA GPU support for containerized workloads.
- [AMD GPU Operator](./amd-gpu-operator/amd-gpu-operator.md) - (Optional) Enables AMD GPU support for ROCm workloads.

### Experimental

- [Debug](./debug/debug.md) - (Optional, Troubleshooting only) Troubleshooting utilities and volume access tools.

### Deprecated

- [Minio](./minio/minio.md) - S3-compatible object storage. Replaced by Rustfs. MinIO stopped publishing images to quay.io in Oct 2025.
