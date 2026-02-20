# Hardware - GPU and device support

Components for GPU support and hardware device management. Required for AI/ML workloads and GPU-accelerated applications.

> **Note:** The AI module components (Ollama, InvokeAI, etc.) require the hardware module to be enabled first for GPU support.

## Quick Start

```sh
# Enable GPU auto-detection
pulumi config set nfd:enabled true

# For NVIDIA GPUs
pulumi config set nvidia-gpu-operator:enabled true

# For AMD GPUs
pulumi config set amd-gpu-operator:enabled true

pulumi up
```

## Components

- **[NFD](./nfd/nfd.md)** - Node Feature Discovery for automatic GPU detection and node labeling
- **[NVIDIA GPU Operator](./nvidia-gpu-operator/nvidia-gpu-operator.md)** - Enables NVIDIA GPU support with time-slicing for workload sharing
- **[AMD GPU Operator](./amd-gpu-operator/amd-gpu-operator.md)** - Enables AMD GPU support for ROCm workloads

## AI Module Dependency

Components in the [AI module](../ai/AI.md) require GPU support from this module:

- Ollama - Needs NVIDIA GPU operator for local LLM inference
- InvokeAI - GPU-accelerated image generation
- KubeAI - GPU resources for model serving

Enable hardware module before deploying AI components:

```sh
# 1. Enable hardware module first
pulumi config set nfd:enabled true
pulumi config set nvidia-gpu-operator:enabled true
pulumi up

# 2. Then enable AI components
pulumi config set ollama:enabled true
pulumi config set open-webui:enabled true
pulumi up
```
