# Ollama

|                       |                                                                |
| --------------------- | -------------------------------------------------------------- |
| Homepage              | https://ollama.com/                                            |
| Helm chart            | https://artifacthub.io/packages/helm/ollama-helm/ollama        |
| Endpoints             | `https://ollama.<tsnet>.ts.net/`                               |
| Environment variables | https://github.com/ollama/ollama/blob/main/envconfig/config.go |

Ollama requires to be run on GPU nodes. You need to install NVidia or AMD operator first.

```sh
# Enable NVidia integration
pulumi config set nvidia-gpu-operator:enabled true
# or AMD
pulumi config set amd-gpu-operator:enabled true

# Increase volume size if needed for bigger models (50 by default, can be expanded later)
pulumi config set ollama:storageSize "100Gi"

# Override appVersion when new Ollama released but Helm chart not yet updated.
# Recommended when using AMD to allow GPU sharing (required to determine image tag)
pulumi config set ollama:appVersion 0.13.1

# Preload models at startup (comma-separated list)
pulumi config set ollama:models "qwen2.5-coder:1.5b,gpt-oss:20b"

# Configure model keep-alive (-1 = keep loaded indefinitely)
pulumi config set ollama:OLLAMA_KEEP_ALIVE "1h"

# Configure maximum context length
pulumi config set ollama:OLLAMA_CONTEXT_LENGTH "65536"

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
ollama pull qwen3

# Vision models
ollama pull qwen3-vl
ollama pull ministral-3

# Coding
ollama pull gpt-oss:20b
ollama pull qwen3-coder

# Code completion, use smaller models for faster responses
ollama pull qwen2.5-coder:1.5b
```
