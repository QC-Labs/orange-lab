# Open-WebUI

|                       |                                                                                   |
| --------------------- | --------------------------------------------------------------------------------- |
| Homepage              | https://openwebui.com/                                                            |
| Helm chart            | https://artifacthub.io/packages/helm/open-webui/open-webui                        |
| Helm chart values     | https://github.com/open-webui/helm-charts/blob/main/charts/open-webui/values.yaml |
| Environment variables | https://docs.openwebui.com/getting-started/env-configuration                      |
| Endpoints             | `https://webui.<domain>/`                                                         |

Authentication happens automatically based on your Tailnet credentials.

> Note that first user will be the admin, but you need to add other users at `https://webui.<domain>/admin/users`.

Models from Ollama and KubeAI/vLLM will be available.

If stable diffusion is enabled, you can generate images based on responses - https://docs.openwebui.com/tutorials/integrations/images/#using-image-generation

```sh
pulumi config set open-webui:enabled true
pulumi up
```
