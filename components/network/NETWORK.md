# Network

Network infrastructure including ingress, routing, and DNS.

## Quick Start

Choose your routing provider:

### Tailscale (recommended for most users)

Uses Tailscale's `.ts.net` domain with built-in HTTPS and authentication.

```sh
pulumi config set orangelab:routingProvider tailscale
pulumi config set tailscale:tailnet <tailnet>.ts.net
pulumi config set tailscale:enabled true
pulumi up
```

### Custom Domain with Traefik

Uses your own domain with automatic TLS certificates from Let's Encrypt.

```sh
pulumi config set orangelab:routingProvider traefik
pulumi config set orangelab:customDomain example.com
pulumi config set cert-manager:enabled true
pulumi config set traefik:enabled true
pulumi up
```

## Components

- **[Tailscale Operator](./tailscale/tailscale.md)** - Ingress with Tailscale authentication and `.ts.net` domains
- **[Traefik](./traefik/traefik.md)** - Ingress controller for custom domains with automatic TLS
- **[Cert-manager](./cert-manager/cert-manager.md)** - Automated certificate management (required for Traefik)
- **[Technitium](./technitium/technitium.md)** - DNS server for cluster-internal resolution

## ServiceLB Configuration

When using Traefik, k3s ServiceLB creates endpoints on port 80/443 on each node. To limit which nodes run the load balancer:

```sh
kubectl label node <node> svccontroller.k3s.cattle.io/enablelb=true
```

Adding the first label switches ServiceLB to whitelist-only mode.

## Routing Provider Override

You can override the global routing provider on a per-application basis:

```sh
# Use Traefik for a specific app even if Tailscale is the global default
pulumi config set myapp:routingProvider traefik
```
