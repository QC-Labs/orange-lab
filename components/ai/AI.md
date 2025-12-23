# AI module

Components related to artificial intelligence, large language models, AI agents and workflows.

Recommended setup/tldr:

```sh
pulumi config set nvidia-gpu-operator:enabled true
pulumi config set ollama:enabled true
pulumi config set open-webui:enabled true
pulumi up
```

> Note: GPU memory is limited so you might encounter out-of-memory errors when loading new models. Only enable components you need. You can check processes using GPU with `nvidia-smi` or `nvtop`. Check Ollama section on how to stop models to free up memory.

## Ollama

|                       |                                                                |
| --------------------- | -------------------------------------------------------------- |
| Homepage              | https://ollama.com/                                            |
| Helm chart            | https://artifacthub.io/packages/helm/ollama-helm/ollama        |
| Endpoints             | `https://ollama.<tsnet>.ts.net/`                               |
| Environment variables | https://github.com/ollama/ollama/blob/main/envconfig/config.go |

Ollama requires to be run on GPU nodes. You need to install NVidia or AMD operator first.

For detailed AMD GPU setup, see the [AMD GPU Guide](/docs/amd-gpu.md).

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

### Ollama CLI

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

### Models

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

## Automatic1111 Stable Diffusion WebUI

|                       |                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Homepage              | https://github.com/AUTOMATIC1111/stable-diffusion-webui                                          |
| Docker image          | https://hub.docker.com/r/universonic/stable-diffusion-webui                                      |
| Dockerfile            | https://github.com/universonic/docker-stable-diffusion-webui                                     |
| Environment variables | https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/Command-Line-Arguments-and-Settings |
| Endpoints             | `https://automatic1111.<tsnet>.ts.net/`                                                          |

```sh
pulumi config set automatic1111:enabled true
pulumi up
```

First time the application starts, it will download Stability Diffusion model (about 4GB) before accepting requests. The container itself is about 7GB.

You can either use the website endpoint or OpenWebUI integration to generate images.

You can disable the app but keep model storage with:

```sh
pulumi config set automatic1111:storageOnly true
pulumi up
```

> If SD.Next is also installed then it will be used for OpenWebUI integration.

## SD.Next

|               |                                                                          |
| ------------- | ------------------------------------------------------------------------ |
| Homepage      | https://vladmandic.github.io/sdnext-docs/                                |
| Source code   | https://github.com/vladmandic/sdnext                                     |
| Docker image  | https://hub.docker.com/r/saladtechnologies/sdnext                        |
| Dockerfile    | https://github.com/SaladTechnologies/sdnext-dynamic/blob/main/Dockerfile |
| CLI arguments | https://vladmandic.github.io/sdnext-docs/CLI-Arguments/                  |
| Endpoints     | `https://sdnext.<tsnet>.ts.net/`                                         |
|               | `https://sdnext.<tsnet>.ts.net/docs`                                     |

```sh
pulumi config set sdnext:enabled true
pulumi up

# disable app and keep model storage
pulumi config set sdnext:storageOnly true
pulumi up
```

SD.Next is another option for image generation with more features and models. The API is compatible with `automatic1111` so if both are enabled then only SD.Next will be integrated with OpenWebUI.

You can either use the website endpoint or OpenWebUI integration to generate images.

## Open-WebUI

|                       |                                                              |
| --------------------- | ------------------------------------------------------------ |
| Homepage              | https://openwebui.com/                                       |
| Helm chart            | https://artifacthub.io/packages/helm/open-webui/open-webui   |
| Environment variables | https://docs.openwebui.com/getting-started/env-configuration |
| Endpoints             | `https://webui.<tsnet>.ts.net/`                              |

Authentication happens automatically based on your Tailnet credentials.

> Note that first user will be the admin, but you need to add other users at `https://webui.<tsnet>>.ts.net/admin/users`.

Models from Ollama and KubeAI/vLLM will be available.

If stable diffusion is enabled, you can generate images based on responses - https://docs.openwebui.com/tutorials/integrations/images/#using-image-generation

```sh
pulumi config set open-webui:enabled true
pulumi up
```

## InvokeAI

|                       |                                                     |
| --------------------- | --------------------------------------------------- |
| Homepage              | https://invoke-ai.github.io/InvokeAI/               |
| Source code           | https://github.com/invoke-ai/InvokeAI               |
| Environment variables | https://invoke-ai.github.io/InvokeAI/configuration/ |
| Tutorials             | https://www.youtube.com/@invokeai                   |
| Endpoints             | `https://invokeai.<tsnet>.ts.net/`                  |

Generative AI platform with a clean user interface.

Note: The community edition does not support user authentication so the images you create will be visible to everyone on your Tailnet.

Note: Unlike _automatic1111_ and _sdnext_, it doesn't integrate with WebUI.

```sh
pulumi config set invokeai:enable true
# optional, gives access to gated models
pulumi config set invokeai:huggingfaceToken <TOKEN> --secret
pulumi up
```

## KubeAI (experimental)

|                |                                                                            |
| -------------- | -------------------------------------------------------------------------- |
| Homepage       | https://www.kubeai.org/                                                    |
| Helm chart     | https://github.com/substratusai/kubeai/blob/main/charts/kubeai             |
| Model catalog  | https://github.com/substratusai/kubeai/blob/main/charts/models/values.yaml |
| vLLM arguments | https://docs.vllm.ai/en/stable/serving/engine_args.html                    |
| Endpoint       | `https://kubeai.<tsnet>.ts.net/`                                           |
|                | `https://kubeai.<tsnet>.ts.net/openai/v1/models`                           |
|                | `https://kubeai.<tsnet>.ts.net/openai/v1/audio/transcriptions`             |

KubeAI provides OpenAI-compatible API to Ollama and vLLM. It allows autoscalling and more control over the models and inference engines.

It's generally more useful for dedicated GPU clusters or when using an agent deployed with cloud providers. It is included here for experiments as it supports vLLM engine as an alternative to Ollama. It's faster but also uses more VRAM.

Currently the models are loaded into memory on first request and stay in memory for 30 minutes. Longhorn volumes are NOT used.

Make sure nothing else is loaded into GPU memory (`nvidia-smi`), otherwise the model pods will likely fail to start.

KubeAI models are downloaded from HuggingFace. You need to create free account and access token with permission to `Read access to contents of all public gated repos you can access` at https://huggingface.co/settings/tokens

```sh
pulumi config set kubeai:enabled true
pulumi config set --secret kubeai:huggingfaceToken <hf_token>
pulumi up
```

Prometheus monitoring and related Grafana dashboard for vLLM can be enabled with:

```sh
pulumi set kubeai:enableMonitoring true
```

Note that Prometheus has to be installed first before changing that switch.

## N8n

|                       |                                                      |
| --------------------- | ---------------------------------------------------- |
| Homepage              | https://n8n.io/                                      |
| Documentation         | https://docs.n8n.io/                                 |
| Source code           | https://github.com/n8n-io/n8n                        |
| Environment variables | https://docs.n8n.io/reference/environment-variables/ |
| Endpoints             | `https://n8n.<tsnet>.ts.net/`                        |

N8n is a visual workflow automation platform that allows you to connect different apps and services to automate tasks.

```sh
# Enable n8n
pulumi config set n8n:enabled true

# Optional: use restored Longhorn volume for app (n8n) and database (n8n-db)
pulumi config set n8n:fromVolume n8n
pulumi config set n8n:db/fromVolume n8n-db

pulumi up
```

After n8n is initialized, save the encryption key to the config. This is needed to restore database from backup:

```sh
export ENCRYPTION_KEY=$(pulumi stack output --show-secrets --json | jq '.ai.n8n.encryptionKey' -r)
pulumi config set n8n:N8N_ENCRYPTION_KEY $ENCRYPTION_KEY --secret

pulumi up
```
