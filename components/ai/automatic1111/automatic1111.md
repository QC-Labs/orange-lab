# Automatic1111 Stable Diffusion WebUI

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
