# Hardware - GPU and device support

Components for GPU support and hardware device management. Required for AI/ML workloads and GPU-accelerated applications.

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
