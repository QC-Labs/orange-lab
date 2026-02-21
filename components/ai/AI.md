# AI module

Components related to artificial intelligence, large language models, AI agents and workflows.

Install any required components from [Hardware module](../hardware/HARDWARE.md) first.

## Quick Start

```sh
# NVidia
pulumi config set nvidia-gpu-operator:enabled true

# AMD
pulumi config set cert-manager:enabled true
pulumi config set amd-gpu-operator:enabled true

# Install Ollama and OpenWebUI
pulumi config set ollama:enabled true # uses any NVidia node by default
pulumi config set open-webui:enabled true
pulumi up
```

> Note: GPU memory is limited so you might encounter out-of-memory errors when loading new models. Only enable components you need. You can check processes using GPU with `nvidia-smi` or `nvtop`. Check Ollama section on how to stop models to free up memory.

## Components

- [Ollama](./ollama/ollama.md) - Run large language models locally with GPU support.
- [Open-WebUI](./open-webui/open-webui.md) - User-friendly web interface for LLMs with RAG support.
- [InvokeAI](./invokeai/invokeai.md) - Professional-grade generative AI toolkit for image creation.
- [N8n](./n8n/n8n.md) - Workflow automation tool with native AI integration.

### Experimental

- [KubeAI](./kubeai/kubeai.md) - Private AI SDK for Kubernetes with OpenAI-compatible API.

### Deprecated

- [Automatic1111](./automatic1111/automatic1111.md) - Stable Diffusion WebUI. Image is stale (~9 months). Use InvokeAI instead.
- [SD.Next](./sdnext/sdnext.md) - Stable Diffusion WebUI. Image appears abandoned. Use InvokeAI instead.
