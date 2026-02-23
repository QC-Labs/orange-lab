# Open-WebUI

|                       |                                                        |
| --------------------- | ------------------------------------------------------ |
| Homepage              | https://openwebui.com/                                 |
| Source code           | https://github.com/open-webui/open-webui               |
| Documentation         | https://docs.openwebui.com/                            |
| Environment variables | https://docs.openwebui.com/reference/env-configuration |
| Endpoints             | `https://webui.<domain>/`                              |

User-friendly AI Interface supporting Ollama, OpenAI API, and other LLM backends.

```sh
# Enable Open-WebUI
pulumi config set open-webui:enabled true

# Use GPU for local Whisper speech recognition (nvidia only)
pulumi config set open-webui:gpu nvidia
pulumi config set open-webui:image ghcr.io/open-webui/open-webui:cuda-slim

# Or use CPU-only image (default)
pulumi config set open-webui:image ghcr.io/open-webui/open-webui:main-slim

pulumi up
```

## Backup and Restore

After Open-WebUI is initialized, save the secret key to the config for backup restoration:

```sh
export SECRET_KEY=$(pulumi stack output --show-secrets --json | jq '.ai."open-webui".secretKey' -r)
pulumi config set open-webui:WEBUI_SECRET_KEY $SECRET_KEY --secret

pulumi up
```

The secret key is used to encrypt OAuth credentials and API keys. Without it, these will need to be re-configured after restoring from backup.

## Admin User Management

If you need to manage the admin user or reset permissions, you can access the admin panel at `https://webui.<domain>/admin/users`.

The first user to sign in becomes the admin automatically when `DEFAULT_USER_ROLE` is set to `admin`.
