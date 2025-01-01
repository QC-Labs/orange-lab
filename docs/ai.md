# AI module

## Ollama

```sh
# Enable NVidia integration
pulumi config set orangelab:nvidia-gpu-operator true

pulumi config set orangelab:ollama true
pulumi up

curl https://ollama.<tsnet>.ts.net
```

Models will be stored on Longhorn volume.

Increase `longhorn:gpuReplicaCount` to replicate volume across nodes with `orangelab/storage=true` and `orangelab/gpu=true` labels

### Ollama CLI

Set CLI to use our `ollama` endpoint instead of the default `localhost:11434`. We'll also add 'ai' alias. Save this as `~/.bashrc.d/ollama`:

```sh
export OLLAMA_HOST=https://ollama.<tsnet>.ts.net/
alias ai="ollama run llama3.2"
```

Add new models with:

```sh
ollama pull llama3.2
```

## Open-WebUI

Authentication happens automatically based on your Tailnet credentials.

Models from Ollama and KubeAI/vLLM will be available.

```sh
pulumi config set orangelab:open-webui true
pulumi up

# Make request to provision HTTP certificate and activate endpoint
curl https://webui.<tsnet>.ts.net
```

## KubeAI

https://www.kubeai.org/

Allows autoscalling and more control over the models and inference engines.

Provides OpenAI-compatible API to Ollama and vLLM.

KubeAI models are downloaded from HuggingFace. You need to create free account and access token with permission to `Read access to contents of all public gated repos you can access` at https://huggingface.co/settings/tokens

Currently the models are loaded into memory on first request. Longhorn volumes are NOT used. KubeAI supports persistent volumes for vLLM however they need to be pre-populated and do not download the model automatically.

```sh
pulumi config set orangelab:kubeai true
pulumi config set --secret kubeai:huggingfaceToken <hf_token>
pulumi up

# Make request to provision HTTP certificate and activate endpoint
curl https://kubeai.<tsnet>.ts.net
```
