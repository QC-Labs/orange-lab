# AMD GPU Guide

> **Note**: AMD GPU drivers are not as stable as NVIDIA depending on the model. Expect segmentation faults and other issues.
>
> **Important Limitation**: AMD GPUs **do not support GPU sharing** like NVIDIA. Only one application can use the GPU at a time on a node. Multiple models within the same application (e.g., Ollama) will work, but you cannot run Ollama and and other GPU app on the same AMD GPU simultaneously.

## Installation

```sh
# Enable automatic GPU detection with NFD
pulumi config set nfd:enabled true
pulumi config set nfd:gpu-autodetect true # default
pulumi up

# Check if nodes are properly labeled:
kubectl get nodes --selector=orangelab/gpu-amd=true

# Install cert-manager
pulumi config set cert-manager:enabled true
pulumi up

# Enable AMD GPU operator
pulumi config set amd-gpu-operator:enabled true
pulumi up
```

## Using AMD GPUs with Applications

### Ollama

```sh
pulumi config set ollama:enabled true
# Switch to ROCm image
pulumi config set ollama:amd-gpu true
pulumi up
```

#### AMD GPU Configuration Overrides

For certain AMD GPUs, you may need to override configuration settings if not properly detected:

```sh
# Example for Radeon 780M
pulumi config set ollama:HSA_OVERRIDE_GFX_VERSION "11.0.0"
pulumi config set ollama:HCC_AMDGPU_TARGETS "gfx1103"
pulumi up
```

The `HSA_OVERRIDE_GFX_VERSION` setting can help with ROCm compatibility, while `HCC_AMDGPU_TARGETS` specifies the architecture target for ROCm applications.

More information at https://github.com/ollama/ollama/blob/main/docs/gpu.md#overrides-on-linux

## Monitoring

AMD GPU dashboards are automatically installed when monitoring is enabled:

-   AMD - Overview
-   AMD - GPU
-   AMD - Job
-   AMD - Compute Node

```sh
pulumi config set amd-gpu-operator:enableMonitoring true
pulumi up
```
