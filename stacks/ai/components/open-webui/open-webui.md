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

# Use latest Helm chart version instead of pinned default
pulumi config set open-webui:version ""

pulumi up
```

## OpenID Connect (Pocket ID)

OIDC login is optional. It is enabled when `OPENID_PROVIDER_URL` is configured. When enabled, `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` are required. If the provider URL is not configured, no OAuth environment variables are passed to Open WebUI. For the general client creation and customization workflow, see [Pocket ID: Using Pocket ID with Applications](../../../../components/security/pocket/pocket.md).

### Pocket ID client

Create the client in Pocket ID before deploying Open WebUI:

| Field          | Value                                             |
| -------------- | ------------------------------------------------- |
| Name           | `Open WebUI`                                      |
| Callback URL   | `<open-webui-url>/oauth/oidc/callback`           |
| Logout callback URL | `<open-webui-url>`                            |
| Launch URL     | `<open-webui-url>`                               |
| Icon           | Optional; see [selfh.st/icons](https://selfh.st/icons/) |

Replace `<open-webui-url>` with the public URL provided by the selected routing provider. For the current Traefik configuration, it is `https://webui.orangelab.space`. The logout callback URL must be registered in Pocket ID exactly as shown.

Copy the client ID and generate/copy the client secret. The secret is shown only once.

### Pulumi configuration

Set these values before the first Open WebUI deployment. The provider URL is the OIDC switch, so omit all three settings to leave OAuth disabled:

```sh
OPENID_PROVIDER_URL=$(pulumi stack output --json | jq -r '.security.endpoints.pocketOidc')

pulumi --cwd stacks/ai config set open-webui:OAUTH_CLIENT_ID <client-id>
pulumi --cwd stacks/ai config set open-webui:OAUTH_CLIENT_SECRET <client-secret> --secret
pulumi --cwd stacks/ai config set open-webui:OPENID_PROVIDER_URL "$OPENID_PROVIDER_URL"

# Optional: label the Open WebUI login button; defaults to "SSO".
pulumi --cwd stacks/ai config set open-webui:OAUTH_PROVIDER_NAME "Pocket ID"

pulumi --cwd stacks/ai up
```

When OIDC is enabled, the local login form, password authentication, and local signups are disabled. OAuth signup remains enabled so Pocket ID users can be provisioned in Open WebUI. Existing Open WebUI accounts are matched by email automatically.

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
