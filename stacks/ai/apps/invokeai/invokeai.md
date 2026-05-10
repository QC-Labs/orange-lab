# InvokeAI

|                       |                                                     |
| --------------------- | --------------------------------------------------- |
| Homepage              | https://invoke-ai.github.io/InvokeAI/               |
| Source code           | https://github.com/invoke-ai/InvokeAI               |
| Environment variables | https://invoke-ai.github.io/InvokeAI/configuration/ |
| Tutorials             | https://www.youtube.com/@invokeai                   |
| Endpoints             | `https://invokeai.<domain>/`                        |

Generative AI platform with a clean user interface.

Note: The community edition does not support user authentication so the images you create will be visible to everyone on your Tailnet.

Note: Unlike _automatic1111_ and _sdnext_, it doesn't integrate with WebUI.

```sh
pulumi config set invokeai:enable true

# (Optional) override image for AMD GPU
# pulumi config set invokeai:image ghcr.io/invoke-ai/invokeai:main-rocm

# (Optional) set token to access gated models
pulumi config set invokeai:huggingfaceToken <TOKEN> --secret
pulumi up
```
