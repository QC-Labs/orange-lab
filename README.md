# OrangeLab

Private infrastructure for cloud natives.

<img src="docs/orange-lab-910-512.png" alt="OrangeLab logo" height="250"/>

## Core components

-   Pulumi (https://www.pulumi.com/) - configuration management, deployments and infrastructure as code
-   Tailscale (https://tailscale.com/) - end-to-end encrypted communication between nodes
-   K3s (https://k3s.io/) - lightweight Kubernetes cluster
-   Longhorn (https://longhorn.io/) - distributed storage

## Principles and goals

-   decentralized - uses your physical machines potentially spread out over geographical locations, minimise dependency on external services and cloud providers
-   private by default - uses Tailscale/WireGuard for end to end encrypted communication, making services public has to be explicitly defined
-   OSS - prefer open source components that can be run locally
-   automation - use Pulumi and Helm to automate most tasks and configuration
-   easy to use - no deep Kubernetes knowledge required, sensible defaults
-   offline mode - continue working (with some limitations) over local network when internet connection lost
-   lightweight - can be run on a single laptop using default configuration
-   scalable - distribute workloads across multiple machines as they become available, optional use of cloud instances for autoscaling
-   self-healing - in case of problems, the system should recover with no user intervention
-   immutable - no snowflakes, as long as there is at least one Longhorn replica available, components can be destroyed and easily recreated

# Applications

[System module](./components/system/SYSTEM.md):

-   `amd-gpu-operator` - AMD GPU support
-   `cert-manager` - certificate management
-   `longhorn` - replicated storage
-   `minio` - S3-compatible storage (used as Longhorn backup target)
-   `nfd` - Node Feature Discovery (GPU autodetection)
-   `nvidia-gpu-operator` - NVidia GPU support
-   `tailscale-operator` - ingress support with Tailscale authentication

[Monitoring module](./components/monitoring/MONITORING.md):

-   `beszel` - Beszel lightweight monitoring
-   `prometheus` - Prometheus/Grafana monitoring

[IoT module](./components/iot/IOT.md):

-   `home-assistant` - sensor and home automation platform

[AI module](./components/ai/AI.md):

-   `automatic1111` - Automatic1111 Stable Diffusion WebUI
-   `kubeai` - Ollama and vLLM models over OpenAI-compatible API
-   `invokeai` - generative AI plaform, community edition
-   `ollama` - local large language models
-   `open-webui` - Open WebUI frontend
-   `sdnext` - SD.Next Stable Diffusion WebUI

# Platforms and limitations

Installation instructions assume your machines are running Bluefin (Developer edition, https://projectbluefin.io/) based on Fedora Silverblue unless otherwise noted.
It should run on any modern Linux distribution with Linux kernel 6.11.6+, even including Raspberry Pi.

Windows and MacOS support is limited. K3s requires Linux to run workloads using _containerd_ directly, however you could have some luck running https://k3d.io/ which uses Docker wrapper to run some containers as long as they do not use persistent storage.
Not a tested configuration but feedback welcome. The issue is Longhorn, which only runs on Linux. More info at https://github.com/k3d-io/k3d/blob/main/docs/faq/faq.md#longhorn-in-k3d

Steps to disable Longhorn and switch to `local-path-provisioner` at [install-system.md](./components/system/SYSTEM.md#disable-longhorn)

Both NVIDIA and AMD GPUs are supported. See [AMD GPU support](/docs/amd-gpu.md) for more information.

# Installation

## Cluster setup

-   [Installation - Setup Guide](./docs/install.md) - Initial Pulumi and Tailscale setup
-   (optional) [Installation - SSH Configuration](./docs/install-ssh.md) - Configure SSH keys on nodes for easier access
-   [Installation - K3s Cluster](./docs/install-k3s.md) - Install Kubernetes cluster and label nodes
-   Deploy system components [components/system/SYSTEM.md](./components/system/SYSTEM.md)

## Deploying applications

After system components have been deployed, you can add any of the optional [#Applications](#applications). Details in each module documentation.

For general application configuration and deployment instructions, see [Configuration Guide](./docs/configuration.md).

# Documentation

-   [Installation - Setup Guide](./docs/install.md) - Initial Pulumi and Tailscale setup
-   [Installation - SSH Configuration](./docs/install-ssh.md) - Configure SSH keys on nodes
-   [Installation - K3s Cluster](./docs/install-k3s.md) - Install and configure Kubernetes cluster and label nodes
-   [Configuration Guide](./docs/configuration.md) - Application configuration and settings
-   [AMD GPU support](./docs/amd-gpu.md) - Using AMD GPUs with OrangeLab
-   [Backup and Restore](./docs/backup.md) - Using Longhorn backups with S3 storage
-   [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
