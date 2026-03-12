# Shimmy

|              |                                                |
| ------------ | ---------------------------------------------- |
| Homepage     | https://github.com/Michael-A-Kuykendall/shimmy |
| Source       | https://github.com/Michael-A-Kuykendall/shimmy |
| Docker Image | ghcr.io/michael-a-kuykendall/shimmy            |
| Endpoints    | `https://shimmy.<domain>/`                     |

Shimmy is an OpenAI-compatible API server for GGUF models written in Rust. It auto-discovers models and supports CPU and GPU inference (CUDA, Vulkan, OpenCL, MLX).

```sh
# (Optional) Use CPU-only mode (default when no GPU operator installed)
pulumi config set shimmy:gpu ""

# (Recommended) Or enable GPU support (requires installing the appropriate operator first)
# pulumi config set nvidia-gpu-operator:enabled true
# pulumi config set shimmy:gpu nvidia
# or
# pulumi config set amd-gpu-operator:enabled true
# pulumi config set shimmy:gpu amd

# (Optional) Increase volume size for bigger models (default: 50Gi)
pulumi config set shimmy:storageSize "100Gi"

# (Optional) Override shimmy image tag (default: latest)
pulumi config set shimmy:image "latest"

# Enable Shimmy
pulumi config set shimmy:enabled true
pulumi up
```

Models will be stored on local Longhorn volume with no replication across nodes.

## Usage

Shimmy provides an OpenAI-compatible API on port 11434. Configure your tools to use the endpoint:

```sh
# Get the endpoint
pulumi stack output --json | jq -r '.ai.endpoints.shimmy'

# For OpenAI-compatible tools, append /v1/ to the URL
# Example: https://shimmy.yourdomain.com/v1/chat/completions
```

## Models

Shimmy auto-discovers GGUF models from the `/app/models` directory. Add models by:

1. Downloading GGUF files to the models volume
2. Models are automatically detected and available via the API

Find GGUF models at:

- Hugging Face: https://huggingface.co/models?library=gguf
- TheBloke quantizations: https://huggingface.co/TheBloke

## GPU Support

- **CPU-only**: Set `shimmy:gpu ""` or leave unset (default)
- **NVIDIA**: Install nvidia-gpu-operator, set `shimmy:gpu nvidia`
- **AMD**: Install amd-gpu-operator, set `shimmy:gpu amd`

Shimmy auto-detects GPU backends (CUDA, Vulkan, OpenCL, MLX).
