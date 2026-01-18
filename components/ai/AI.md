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

## Components

- [Ollama](./ollama.md) - Run large language models locally with GPU support.
- [Automatic1111](./automatic1111.md) - Popular web interface for Stable Diffusion image generation.
- [SD.Next](./sdnext.md) - Advanced Stable Diffusion web interface with extended features.
- [Open-WebUI](./open-webui.md) - User-friendly web interface for LLMs with RAG support.
- [InvokeAI](./invokeai.md) - Professional-grade generative AI toolkit for image creation.
- [KubeAI](./kubeai.md) - Private AI SDK for Kubernetes with OpenAI-compatible API.
- [N8n](./n8n.md) - Workflow automation tool with native AI integration.
