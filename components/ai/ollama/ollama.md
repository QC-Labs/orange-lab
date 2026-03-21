# Ollama

|                       |                                                                |
| --------------------- | -------------------------------------------------------------- |
| Homepage              | https://ollama.com/                                            |
| Helm chart            | https://artifacthub.io/packages/helm/ollama-helm/ollama        |
| Endpoints             | `https://ollama.<domain>/`                                     |
| Environment variables | https://github.com/ollama/ollama/blob/main/envconfig/config.go |

Ollama defaults to NVIDIA GPU support. To run on CPU only, explicitly disable GPU.

```sh
# Optional: Disable GPU support for CPU-only mode
pulumi config set ollama:gpu ""

# Or enable specific GPU support (requires installing the appropriate operator first)
# pulumi config set nvidia-gpu-operator:enabled true
# pulumi config set ollama:gpu nvidia
# or
# pulumi config set amd-gpu-operator:enabled true
# pulumi config set ollama:gpu amd

# Increase volume size if needed for bigger models (50 by default, can be expanded later)
pulumi config set ollama:storageSize "100Gi"

# Override appVersion when new Ollama released but Helm chart not yet updated.
# Recommended when using AMD to allow GPU sharing (required to determine image tag)
pulumi config set ollama:appVersion 0.13.1

# Limit GPU access to specific devices in multi-GPU setups
# (comma-separated device IDs, 0-indexed)
pulumi config set ollama:HIP_VISIBLE_DEVICES "0"
# or for NVIDIA
pulumi config set ollama:CUDA_VISIBLE_DEVICES "0,1"

# Preload models at startup (comma-separated list)
pulumi config set ollama:models "qwen2.5-coder:1.5b,gpt-oss:20b"

# Configure model keep-alive (-1 = keep loaded indefinitely)
pulumi config set ollama:OLLAMA_KEEP_ALIVE "1h"

# Configure maximum context length
pulumi config set ollama:OLLAMA_CONTEXT_LENGTH "65536"

# (Optional) Enable Flash Attention
# pulumi config set ollama:OLLAMA_FLASH_ATTENTION "true"
# (Optional) Configure KV cache type (f16, q8_0, q4_0)
# pulumi config set ollama:OLLAMA_KV_CACHE_TYPE "q8_0"

# Enable Ollama
pulumi config set ollama:enabled true
pulumi up
```

Models will be stored on local Longhorn volume with no replication across nodes.

## Ollama CLI

Default endpoint used by ollama is `localhost:11434`.

Override it by creating `~/.bashrc.d/ollama`:

```sh
export OLLAMA_HOST=<endpoint>
```

Get the new endpoint with:

```sh
pulumi stack output --json | jq -r '.ai.endpoints.ollama'
```

You can also setup your tools to use OpenAPI-compatible endpoint by adding `/v1/` to the URL.

## Models

Check available models and sizes at https://ollama.com/search

Add local models with:

```sh
# Chat
ollama pull deepseek-r1
ollama pull gpt-oss
ollama pull qwen3.5

# Vision models
ollama pull qwen3.5
ollama pull qwen3-vl
ollama pull ministral-3

# Coding
ollama pull glm-4.7-flash
ollama pull gpt-oss:20b
ollama pull qwen3-coder

# Code completion, use smaller models for faster responses
ollama pull qwen2.5-coder:1.5b
```
