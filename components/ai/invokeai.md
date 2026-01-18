# InvokeAI

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
