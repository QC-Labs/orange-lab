# Immich

|                                |                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Homepage                       | https://immich.app/                                                                           |
| Source code                    | https://github.com/immich-app/immich                                                          |
| Documentation                  | https://docs.immich.app/                                                                      |
| Environment variables          | https://docs.immich.app/install/environment-variables                                         |
| CLI commands                   | https://docs.immich.app/administration/server-commands                                        |
| cloudnative-vectorchord images | https://github.com/tensorchord/cloudnative-vectorchord/pkgs/container/cloudnative-vectorchord |
| Endpoints                      | `https://immich.<domain>/`                                                                    |

Self-hosted photo and video backup solution. Alternative to Google Photos.

```sh
# Enable Immich
pulumi config set immich:enabled true

# Use restored Longhorn volume for app
pulumi config set immich:fromVolume immich

# (Optional) Increase storage size and DB volume size
pulumi config set immich:storageSize 200Gi
pulumi config set immich:db/storageSize 10Gi

# (Optional) Enable machine-learning with NVidia GPU acceleration
pulumi config set immich:machine-learning/enabled true
pulumi config set immich:machine-learning/gpu nvidia

# (Alternative) Use standard cloudnative-pg images with pgvector extension
pulumi config set immich:db/image ''
pulumi config set immich:db/postInitApplicationSQL "CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE,CREATE EXTENSION IF NOT EXISTS vector CASCADE"

pulumi up
```

After Immich is initialized, save the JWT secret to the config for backup restoration:

```sh
export JWT_SECRET=$(pulumi stack output --show-secrets --json | jq '.media.immich.jwtSecret' -r)
pulumi config set immich:JWT_SECRET $JWT_SECRET --secret

pulumi up
```

## OAuth Authentication (Pocket ID)

Immich OAuth is configured from the Immich administration UI, so users can continue changing Immich settings there. This requires [Pocket ID](../../../../components/security/pocket/pocket.md) to be deployed.

### Create the Pocket ID client

Run the helper from the media stack directory after deploying Pocket ID and configuring the core stack's `pocket:apiKey`:

```sh
cd stacks/media

IMMICH_URL=$(pulumi stack output --json | jq -er '.endpoints.immich')

../../scripts/pocket-client.sh \
  --app-name immich \
  --client-name "Immich" \
  --launch-url "$IMMICH_URL" \
  --callback-url "$IMMICH_URL/auth/login" \
  --callback-url "$IMMICH_URL/user-settings" \
  --callback-url app.immich:///oauth-callback \
  --dark-icon-url https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/immich-dark.svg \
  --light-icon-url https://cdn.jsdelivr.net/gh/selfhst/icons@main/svg/immich.svg
```

The helper creates all required web and mobile callbacks, prints the OIDC issuer URL, client ID, and client secret, and reuses existing clients without rotating their secrets. Use those values in Immich's OAuth settings; do not apply the printed `immich:auth` commands.

### Configure Immich

In Immich, go to **Administration -> Settings -> Authentication Settings -> OAuth** and set:

| Setting | Value |
| --- | --- |
| Enable Login with OAuth | Enabled |
| Issuer URL | The `OIDC issuer URL` printed by `pocket-client.sh` |
| Client ID | The client ID from Pocket ID |
| Client Secret | The client secret from Pocket ID |
| Scope | `openid email profile` |
| End Session Endpoint | Empty |
| Button Text | `Login with Pocket ID` |
| Auto Register | Enabled |
| Auto Launch | Enabled; automatically redirects users to Pocket ID from the login page |

The issuer URL is exported by the core stack as `security.oidcProviderUrl`. If the Pocket ID hostname changes, run the helper again and use the updated printed value.

Save the settings and test the OAuth login. For mobile login, keep `app.immich:///oauth-callback` registered with Pocket ID.

When **Auto Launch** is enabled, use the following URL to access the regular Immich login page and sign in with a local administrator account:

```text
https://immich.<domain>/auth/login?autoLaunch=0
```

## Reset Admin Password

If you need to reset the admin password, exec into the Immich server pod and use the `immich-admin` CLI:

```sh
# Exec into the server container
./scripts/exec.sh immich

# Reset the admin password
immich-admin reset-admin-password
```

See [Server Commands](https://docs.immich.app/administration/server-commands) for more CLI commands like `list-users`, `enable-oauth-login`, etc.
