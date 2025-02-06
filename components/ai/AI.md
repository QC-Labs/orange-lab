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

|            |                                                         |
| ---------- | ------------------------------------------------------- |
| Homepage   | https://ollama.com/                                     |
| Helm chart | https://artifacthub.io/packages/helm/ollama-helm/ollama |
| Endpoints  | `https://ollama.<tsnet>.ts.net/`                        |

```sh
# Enable NVidia integration
pulumi config set nvidia-gpu-operator:enabled true

# Increase volume size if needed for bigger models (50 by default, can be expanded later)
pulumi config set ollama:storageSize "100Gi"

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

By default models are stopped after 5 minutes. You can see loaded models and stop them with:

```sh
ollama ps
ollama stop <id>
```

### Visual Studio Code

You can use https://www.continue.dev/ extension to connect to Ollama for code completion and chat.

`config.json` for the extension has to be updated to modify `apiBase` and point to our Ollama instance instead of the default `localhost`. Example config fragment:

```json
  "models": [
    {
      "model": "llama3.2",
      "title": "Ollama llama3.2",
      "apiBase": "https://ollama.<tsnet>.ts.net/",
      "provider": "ollama"
    },
    {
      "model": "qwen2.5-coder:7b",
      "title": "Ollama qwen2.5-coder",
      "apiBase": "https://ollama.<tsnet>.ts.net/",
      "provider": "ollama"
    },
    {
      "model": "deepseek-coder-v2:16b",
      "title": "Ollama deepseek-coder-v2",
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

|                       |                                                                              |
| --------------------- | ---------------------------------------------------------------------------- |
| Homepage              | https://openwebui.com/                                                       |
| Helm chart            | https://artifacthub.io/packages/helm/open-webui/open-webui                   |
| Environment variables | https://docs.openwebui.com/getting-started/advanced-topics/env-configuration |
| Endpoints             | `https://webui.<tsnet>.ts.net/`                                              |

Authentication happens automatically based on your Tailnet credentials.

> Note that first user will be the admin, but you need to add other users at `https://webui.<tsnet>>.ts.net/admin/users`.

Models from Ollama and KubeAI/vLLM will be available.

If stable diffusion is enabled, you can generate images based on responses - https://docs.openwebui.com/tutorials/integrations/images/#using-image-generation

```sh
pulumi config set open-webui:enabled true
pulumi up
```

## KubeAI

|            |                                                                |
| ---------- | -------------------------------------------------------------- |
| Homepage   | https://www.kubeai.org/                                        |
| Helm chart | https://github.com/substratusai/kubeai/blob/main/charts/kubeai |
| Endpoint   | `https://kubeai.<tsnet>.ts.net/`                               |

Allows autoscalling and more control over the models and inference engines.

Provides OpenAI-compatible API to Ollama and vLLM.

KubeAI models are downloaded from HuggingFace. You need to create free account and access token with permission to `Read access to contents of all public gated repos you can access` at https://huggingface.co/settings/tokens

Currently the models are loaded into memory on first request. Longhorn volumes are NOT used. KubeAI supports persistent volumes for vLLM however they need to be pre-populated and do not download the model automatically.

```sh
pulumi config set kubeai:enabled true
pulumi config set --secret kubeai:huggingfaceToken <hf_token>
pulumi up
```
