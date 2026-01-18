# OrangeLab

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QC-Labs/orange-lab)

Private infrastructure for cloud natives.

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

[System module](./components/system/SYSTEM.md):

- [`amd-gpu-operator`](./components/system/amd-gpu-operator/amd-gpu-operator.md) - AMD GPU support
- [`cert-manager`](./components/system/cert-manager.md) - certificate management
- [`longhorn`](./components/system/longhorn/longhorn.md) - replicated storage
- [`minio`](./components/system/minio/minio.md) - S3-compatible storage (used as Longhorn backup target)
- [`nfd`](./components/system/nfd.md) - Node Feature Discovery (GPU autodetection)
- [`nvidia-gpu-operator`](./components/system/nvidia-gpu-operator.md) - NVidia GPU support
- [`tailscale-operator`](./components/system/tailscale/tailscale.md) - ingress support with Tailscale authentication
- [`traefik`](./components/system/traefik.md) - reverse proxy for custom domain support

[Data module](./components/data/DATA.md):

- [`cloudnative-pg`](./components/data/cloudnative-pg/cloudnative-pg.md) - PostgreSQL operator
- [`mariadb-operator`](./components/data/mariadb-operator/mariadb-operator.md) - MariaDB operator

[Monitoring module](./components/monitoring/MONITORING.md):

- [`beszel`](./components/monitoring/beszel/beszel.md) - Beszel lightweight monitoring
- [`prometheus`](./components/monitoring/prometheus/prometheus.md) - Prometheus/Grafana monitoring

[IoT module](./components/iot/IOT.md):

- [`home-assistant`](./components/iot/home-assistant/home-assistant.md) - sensor and home automation platform

[AI module](./components/ai/AI.md):

- [`automatic1111`](./components/ai/automatic1111.md) - Automatic1111 Stable Diffusion WebUI
- [`kubeai`](./components/ai/kubeai.md) - Ollama and vLLM models over OpenAI-compatible API
- [`invokeai`](./components/ai/invokeai.md) - generative AI plaform, community edition
- [`n8n`](./components/ai/n8n.md) - AI workflow automation
- [`ollama`](./components/ai/ollama.md) - local large language models
- [`open-webui`](./components/ai/open-webui.md) - Open WebUI frontend
- [`sdnext`](./components/ai/sdnext.md) - SD.Next Stable Diffusion WebUI

[Bitcoin module](./components/bitcoin/BITCOIN.md):

- [`bitcoin-core`](./components/bitcoin/bitcoin-core.md) - Bitcoin Core node
- [`bitcoin-knots`](./components/bitcoin/bitcoin-knots.md) - Bitcoin Knots node
- [`electrs`](./components/bitcoin/electrs.md) - Electrs (Electrum) server implementation
- [`mempool`](./components/bitcoin/mempool.md) - Blockchain explorer

[Office module](./components/office/OFFICE.md):

- [`nextcloud`](./components/office/nextcloud.md) - File sharing and collaboration suite

# Platforms and limitations

Installation instructions assume your machines are running Bluefin (Developer edition, https://projectbluefin.io/) based on Fedora Silverblue unless otherwise noted.
It should run on any modern Linux distribution with Linux kernel 6.11.6+, even including Raspberry Pi.

Windows and MacOS support is limited, specifically they cannot be used as storage nodes.

See [Disabling Longhorn Guide](./docs/longhorn-disable.md) with instructions on using `local-path-provisioner` instead of Longhorn.

Both NVIDIA and AMD GPUs are supported. See [AMD GPU support](/docs/amd-gpu.md) for more information.

# Installation

- [Installation - Setup Guide](./docs/install.md) - Initial Pulumi and Tailscale setup
- [Installation - SSH Configuration](./docs/install-ssh.md) (optional) - Configure SSH keys on nodes for easier access
- [Installation - Node Configuration](./docs/install-nodes.md) - Configure nodes (firewall, suspend settings)
- [Installation - K3s Cluster](./docs/install-k3s.md) - Install Kubernetes cluster and label nodes
- [components/system/SYSTEM.md](./components/system/SYSTEM.md) - Deploy system components
- [components/data/DATA.md](./components/data/DATA.md) - Deploy data components (databases)

After system components have been deployed, you can add any of the optional [#Applications](#applications). Details in each module documentation.

For general application configuration and deployment instructions, see [Configuration Guide](./docs/configuration.md).

# Documentation

- [Ask Devin/DeepWiki](https://deepwiki.com/QC-Labs/orange-lab) - AI generated documentation and good place to ask questions
- [Configuration Guide](./docs/configuration.md) - Application configuration and deployment
- [Upgrade Guide](./docs/upgrade.md) - Upgrading your OrangeLab installation
- [Disabling Longhorn](./docs/longhorn-disable.md) - Running OrangeLab without distributed storage
- [AMD GPU support](./docs/amd-gpu.md) - Using AMD GPUs with OrangeLab
- [Electrs Wallet Guide](./docs/electrs-wallet.md) - Connecting Bitcoin wallets to your Electrs server
- [Backup and Restore](./docs/backup.md) - Using Longhorn backups with S3 storage
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
