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
cd stacks/ai

# Enable Open-WebUI
pulumi config set open-webui:enabled true

# Reference the deployed core stack: organization/project/stack
pulumi config set orangelab:coreStackRef example-org/orangelab/lab

# Deploy
pulumi up
```

## OpenID Connect (Pocket ID)

OIDC is optional. The discovery URL is resolved automatically from the core stack.

- The core stack must have Pocket ID enabled and deployed first.
- The discovery URL comes from `security.oidcProviderUrl` through `orangelab:coreStackRef`.
- Omit `open-webui:auth` to leave OAuth disabled.

### Automated setup (Recommended)

Run the generic Pocket ID client script from the AI stack directory:

```sh
# Set the core stack reference if it is not already configured
pulumi config set orangelab:coreStackRef example-org/orangelab/lab

# Create or refresh the Pocket ID client
../../scripts/pocket-client.sh \
  --app-name open-webui \
  --client-name "Open WebUI" \
  --launch-url https://webui.example.org \
  --callback-path /oauth/oidc/callback \
  --dark-icon-url https://cdn.jsdelivr.net/gh/selfhst/icons@main/webp/open-webui-dark.webp \
  --light-icon-url https://cdn.jsdelivr.net/gh/selfhst/icons@main/webp/open-webui.webp
```

The script can be run before the first Open WebUI deployment as long as the public launch URL is known. It prints the client ID and secret commands. Run those commands, then run `pulumi up`.

Existing clients are reused without rotating their secret. If the client was deleted, the script creates a new client and secret.

### Manual setup

Create the client in Pocket ID before deploying Open WebUI:

| Field               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| Name                | `Open WebUI`                                            |
| Callback URL        | `<open-webui-url>/oauth/oidc/callback`                  |
| Launch URL          | `<open-webui-url>`                                      |
| Icon                | Optional; see [selfh.st/icons](https://selfh.st/icons/) |

Replace `<open-webui-url>` with the public URL provided by the selected routing provider. For the current Traefik configuration, it is `https://webui.orangelab.space`.

Copy the client ID and generate/copy the client secret. The secret is shown only once.

Set the client values in the AI stack:

```sh
pulumi config set open-webui:auth pocket
pulumi config set open-webui:auth/clientId <client-id>
pulumi config set open-webui:auth/clientSecret <client-secret> --secret

# Optional: change the login label or override the discovery URL
pulumi config set open-webui:auth/providerName "Pocket ID"
# pulumi config set open-webui:auth/providerUrl https://pocket.example.com/.well-known/openid-configuration

pulumi up
```

When OIDC is enabled:

- The local login form, password authentication, and local signups are disabled.
- OAuth signup remains enabled so Pocket ID users can be provisioned in Open WebUI.
- Existing Open WebUI accounts are matched by email automatically.

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
