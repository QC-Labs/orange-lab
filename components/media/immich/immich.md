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
