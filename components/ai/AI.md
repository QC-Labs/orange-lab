# AI module

Components related to artificial intelligence, large language models, AI agents and workflows.

Recommended setup/tldr:

```sh
pulumi config set nvidia-gpu-operator:enabled true
pulumi config set ollama:enabled true
pulumi config set open-webui:enabled true
pulumi up
```

> Note: GPU memory is limited so you might encounter out-of-memory errors when loading new models. Only enable components you need. You can check processes using GPU with `nvidia-smi`. Check Ollama section on how to stop models to free up memory.

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

# Preload models at startup (comma-separated list)
pulumi config set ollama:models "qwen2.5-coder:1.5b,llama3.2"

# Configure model keep-alive (-1 = keep loaded indefinitely)
pulumi config set ollama:OLLAMA_KEEP_ALIVE "1h"

# Configure maximum context length
pulumi config set ollama:OLLAMA_CONTEXT_LENGTH "65536"

# Enable Ollama
pulumi config set ollama:enabled true
pulumi up
```

Models will be stored on local Longhorn volume with no replication across nodes.
You can disable the app but keep model storage with:

```sh
pulumi config set ollama:storageOnly true
pulumi up
```

### Ollama CLI

Set CLI to use our `ollama` endpoint instead of the default `localhost:11434`. We'll also add 'ai' alias. Save this as `~/.bashrc.d/ollama`:

```sh
export OLLAMA_HOST=https://ollama.<tsnet>.ts.net/
alias ai="ollama run llama3.2"
```

Add models with:

```sh
# Recommended for general chat, check available model sizes at https://ollama.com/search
ollama pull deepseek-r1
ollama pull phi4
ollama pull llama3.2

# Vision to text
ollama pull llama3.2-vision
ollama pull llava

# Coding chat
ollama pull deepseek-coder-v2
ollama pull qwen2.5-coder:7b

# Code completion, use smaller models for faster responses
ollama pull qwen2.5-coder:1.5b
```

By default models are stopped after 5 minutes of inactivity. Models specified in the `ollama:models` configuration will be automatically loaded at startup and stay loaded.

You can see loaded models and stop them with:

```sh
ollama ps
ollama stop <id>
```

### Visual Studio Code

You can use https://www.continue.dev/ extension to connect to Ollama for code completion and chat.

`config.json` for the extension has to be updated to modify `apiBase` and point to our Ollama instance instead of the default `localhost`.

Available settings at https://docs.continue.dev/customize/deep-dives/autocomplete

Example config fragment:

```json
  "models": [
    {
      "model": "AUTODETECT",
      "title": "Autodetect",
      "apiBase": "https://ollama.<tsnet>.ts.net/",
      "provider": "ollama"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Qwen2.5-Coder 1.5B",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b",
    "apiBase": "https://ollama.<tsnet>.ts.net/",
    "disableInFiles": ["*.txt"]
  },

```

### Mods CLI

[Mods](https://github.com/charmbracelet/mods) is a command-line AI assistant that can be configured to use our Ollama instance.

Configure it with `mods --settings` and update the configuration file:

```yaml
ollama:
    base-url: https://ollama.<tsnet>.ts.net/api
    default-model: qwen3
    models: # https://ollama.com/library
        'qwen3:8b':
            aliases: ['qwen3']
            max-input-chars: 650000
        'gemma3:12b-it-qat':
            aliases: ['gemma3']
            max-input-chars: 650000
```

After configuration, you can use `mods` from any terminal to access your Ollama models.

Example usage:

```sh
# General prompt (specify model with -m)
mods -m gemma3 "explain kubernetes operators"

# Pipe command output to mods for analysis
rpm-ostree status -v | mods "is my system up to date?"

# Process files
mods -f config.yaml "explain this configuration"
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

### Visual Studio Code

Similar to Ollama, you can configure Continue to use KubeAi/vLLM. Depending on the model, max tokens or context length will have to be adjusted.

```json
"models": [
    {
        "model": "qwen2.5-coder-1.5b-rtx4070-8gb",
        "title": "vLLM qwen2.5-coder",
        "provider": "openai",
        "apiBase": "https://kubeai.<tsnet>.ts.net/openai/v1",
        "apiKey": "NOT USED"
    },
],
"tabAutocompleteModel": {
    "title": "Qwen2.5-Coder 1.5B",
    "provider": "openai",
    "model": "qwen2.5-coder-1.5b-rtx4070-8gb",
    "apiBase": "https://kubeai.<tsnet>.ts.net/openai/v1",
    "disableInFiles": ["*.txt", "*.md"]
},
"tabAutocompleteOptions": {
    "disabled": "false",
    "debounceDelay": 1000,
    "maxPromptTokens": 1024,
    "contextLength": 1024
},
```

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

# Optional: add PostgreSQL replicas, 1 is default (just primary)
pulumi config set n8n:db/instances 3

# Update cluster
pulumi up
```

After n8n is initialized, save the encryption key to the config. This is needed to restore database from backup:

```sh
export ENCRYPTION_KEY=$(pulumi stack output --show-secrets --json | jq '.ai.n8n.encryptionKey' -r)
pulumi config set n8n:N8N_ENCRYPTION_KEY $ENCRYPTION_KEY --secret

pulumi up
```
