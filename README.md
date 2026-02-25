# OrangeLab

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QC-Labs/orange-lab)

Private distributed infrastructure on consumer hardware.

<img src="docs/orange-lab-910-512.png" alt="OrangeLab logo" height="250"/>

## Core components

- Pulumi (https://www.pulumi.com/) - configuration management, deployments and infrastructure as code
- Tailscale (https://tailscale.com/) - end-to-end encrypted communication between nodes
- K3s (https://k3s.io/) - lightweight Kubernetes cluster
- Longhorn (https://longhorn.io/) - distributed storage

## Principles and goals

- decentralized - uses your physical machines potentially spread out over geographical locations, minimise dependency on external services and cloud providers
- private by default - uses Tailscale/WireGuard for end to end encrypted communication, making services public has to be explicitly defined
- OSS - only open source components that can be run locally
- automation - use Pulumi and Helm to automate most tasks and configuration
- easy to use - no deep Kubernetes knowledge required, sensible defaults
- offline mode - continue working (with some limitations) over local network when internet connection lost
- lightweight - can be run on a single laptop using default configuration, focus on consumer hardware
- scalable - distribute workloads across multiple machines as they become available, optional use of cloud instances
- self-healing - in case of problems, the system should recover with minimal user intervention
- immutable - no snowflakes, as long as there is at least one Longhorn replica available, components can be destroyed and easily recreated
- simple disaster recovery - all you need to recreate the system from scratch is Longhorn backups and Pulumi config

# Applications

### Base modules

[Network](./components/network/NETWORK.md):

- [`cert-manager`](./components/network/cert-manager/cert-manager.md) - certificate management
- [`tailscale-operator`](./components/network/tailscale/tailscale.md) - ingress support with Tailscale authentication
- [`traefik`](./components/network/traefik/traefik.md) - reverse proxy for custom domain support
- [`technitium`](./components/network/technitium/technitium.md) - DNS server and ad-blocker

[Storage](./components/storage/STORAGE.md):

- [`longhorn`](./components/storage/longhorn/longhorn.md) - replicated storage
- [`rustfs`](./components/storage/rustfs/rustfs.md) - S3-compatible storage (Longhorn backup target)
- [`minio`](./components/storage/minio/minio.md) - (Deprecated) S3-compatible object storage.

[Hardware](./components/hardware/HARDWARE.md):

- [`amd-gpu-operator`](./components/hardware/amd-gpu-operator/amd-gpu-operator.md) - AMD GPU support
- [`nfd`](./components/hardware/nfd/nfd.md) - Node Feature Discovery (GPU autodetection)
- [`nvidia-gpu-operator`](./components/hardware/nvidia-gpu-operator/nvidia-gpu-operator.md) - NVidia GPU support

[Data](./components/data/DATA.md):

- [`cloudnative-pg`](./components/data/cloudnative-pg/cloudnative-pg.md) - PostgreSQL operator
- [`mariadb-operator`](./components/data/mariadb-operator/mariadb-operator.md) - MariaDB operator

[Monitoring](./components/monitoring/MONITORING.md):

- [`beszel`](./components/monitoring/beszel/beszel.md) - Beszel lightweight monitoring
- [`prometheus`](./components/monitoring/prometheus/prometheus.md) - Prometheus/Grafana monitoring

### Optional modules

[IoT](./components/iot/IOT.md):

- [`home-assistant`](./components/iot/home-assistant/home-assistant.md) - sensor and home automation platform

[Media](./components/media/MEDIA.md):

- [`immich`](./components/media/immich/immich.md) - Self-hosted photo and video backup solution

[AI](./components/ai/AI.md):

- [`invokeai`](./components/ai/invokeai/invokeai.md) - generative AI plaform, community edition
- [`n8n`](./components/ai/n8n/n8n.md) - AI workflow automation
- [`ollama`](./components/ai/ollama/ollama.md) - local large language models
- [`open-webui`](./components/ai/open-webui/open-webui.md) - Open WebUI frontend
- [`kubeai`](./components/ai/kubeai/kubeai.md) - (Experimental) Private AI SDK for Kubernetes with OpenAI-compatible API
- [`automatic1111`](./components/ai/automatic1111/automatic1111.md) - (Deprecated) Stable Diffusion WebUI.
- [`sdnext`](./components/ai/sdnext/sdnext.md) - (Deprecated) Stable Diffusion WebUI.

[Bitcoin](./components/bitcoin/BITCOIN.md):

- [`bitcoin-core`](./components/bitcoin/bitcoin-core/bitcoin-core.md) - Bitcoin Core node
- [`bitcoin-knots`](./components/bitcoin/bitcoin-knots/bitcoin-knots.md) - Bitcoin Knots node
- [`electrs`](./components/bitcoin/electrs/electrs.md) - Electrs (Electrum) server implementation
- [`mempool`](./components/bitcoin/mempool/mempool.md) - Blockchain explorer

[Office](./components/office/OFFICE.md):

- [`nextcloud`](./components/office/nextcloud/nextcloud.md) - File sharing, calendars, contacts, tasks

[Security](./components/security/SECURITY.md):

- [`vaultwarden`](./components/security/vaultwarden/vaultwarden.md) - Bitwarden-compatible password manager

[Dev](./components/dev/DEV.md):

- [`debug`](./components/dev/debug/debug.md) - (Experimental) Troubleshooting utilities and volume access tools

# Platforms and limitations

Installation instructions assume your machines are running Bluefin (Developer edition, https://projectbluefin.io/) based on Fedora Silverblue unless otherwise noted.
It should run on any modern Linux distribution with Linux kernel 6.11.6+, even including Raspberry Pi.

Windows and MacOS support is limited, specifically they cannot be used as storage nodes.

See [Disabling Longhorn Guide](./docs/longhorn-disable.md) with instructions on using `local-path-provisioner` instead of Longhorn.

Both NVIDIA and AMD GPUs are supported. See [Hardware module](/components/hardware/HARDWARE.md) for more information.

# Installation

- [Installation - Admin node](./docs/install-admin.md) - Initial Pulumi and Tailscale setup
- [Installation - SSH configuration](./docs/install-ssh.md) (Optional) - Configure SSH keys on nodes for easier access
- [Installation - Linux node configuration](./docs/install-linux.md) - Configure nodes (firewall, suspend settings)
- [Installation - K3s cluster](./docs/install-k3s.md) - Install Kubernetes cluster and label nodes

After setting up the Kubernetes cluster, deploy the core modules:

1. [Network](./components/network/NETWORK.md) - Routing provider (Tailscale or Traefik)
2. [Storage](./components/storage/STORAGE.md) - Distributed storage (Longhorn) and backups
3. [Hardware](./components/hardware/HARDWARE.md) - (Optional) GPU support

After core modules are deployed, you can install any optional applications from the [Applications](#applications) section above.

For general application configuration and deployment instructions, see [Configuration Guide](./docs/configuration.md).

# Documentation

- [Ask Devin/DeepWiki](https://deepwiki.com/QC-Labs/orange-lab) - AI generated documentation and good place to ask questions
- [Configuration Guide](./docs/configuration.md) - Application configuration and deployment
- [Upgrade Guide](./docs/upgrade.md) - Upgrading your OrangeLab installation
- [Disabling Longhorn](./docs/longhorn-disable.md) - Running OrangeLab without distributed storage
- [Backup and Restore](./docs/backup.md) - Using Longhorn backups with S3 storage
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
