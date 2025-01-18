# AI module

Components related to artificial intelligence, large language models, AI agents and workflows.

Recommended setup/tldr:

```sh
pulumi config set orangelab:nvidia-gpu-operator true
pulumi config set orangelab:ollama true
pulumi config set orangelab:open-webui true
pulumi up
```

## Ollama

|            |                                                         |
| ---------- | ------------------------------------------------------- |
| Homepage   | https://ollama.com/                                     |
| Helm chart | https://artifacthub.io/packages/helm/ollama-helm/ollama |
| Endpoints  | `https://ollama.<tsnet>.ts.net/`                        |

```sh
# Enable NVidia integration
pulumi config set orangelab:nvidia-gpu-operator true

pulumi config set orangelab:ollama true
pulumi up
```

Models will be stored on local Longhorn volume with no replication across nodes.

### Ollama CLI

Set CLI to use our `ollama` endpoint instead of the default `localhost:11434`. We'll also add 'ai' alias. Save this as `~/.bashrc.d/ollama`:

```sh
export OLLAMA_HOST=https://ollama.<tsnet>.ts.net/
alias ai="ollama run llama3.2"
```

Add models with:

```sh
# Recommended for general chat
ollama pull phi4:14b
ollama pull llama3.2:3b

# Vision to text
ollama pull llama3.2-vision:11b
ollama pull llama3.2-vision:90b
ollama pull llava:7b
ollama pull llava:34b

# Coding chat
ollama pull deepseek-coder-v2:16b
ollama pull qwen2.5-coder:7b

# Code completion
ollama pull qwen2.5-coder:1.5b
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

## Open-WebUI

|                       |                                                                              |
| --------------------- | ---------------------------------------------------------------------------- |
| Homepage              | https://openwebui.com/                                                       |
| Helm chart            | https://artifacthub.io/packages/helm/open-webui/open-webui                   |
| Environment variables | https://docs.openwebui.com/getting-started/advanced-topics/env-configuration |
| Endpoints             | `https://webui.<tsnet>.ts.net/`                                              |

Authentication happens automatically based on your Tailnet credentials.

Models from Ollama and KubeAI/vLLM will be available.

```sh
pulumi config set orangelab:open-webui true
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
pulumi config set orangelab:kubeai true
pulumi config set --secret kubeai:huggingfaceToken <hf_token>
pulumi up
```
