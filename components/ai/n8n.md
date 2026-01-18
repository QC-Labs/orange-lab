# N8n

|                       |                                                      |
| --------------------- | ---------------------------------------------------- |
| Homepage              | https://n8n.io/                                      |
| Documentation         | https://docs.n8n.io/                                 |
| Source code           | https://github.com/n8n-io/n8n                        |
| Environment variables | https://docs.n8n.io/reference/environment-variables/ |
| Endpoints             | `https://n8n.<tsnet>.ts.net/`                        |

N8n is a visual workflow automation platform that allows you to connect different apps and services to automate tasks.

```sh
# Enable n8n
pulumi config set n8n:enabled true

# Optional: use restored Longhorn volume for app (n8n) and database (n8n-db)
pulumi config set n8n:fromVolume n8n
pulumi config set n8n:db/fromVolume n8n-db

pulumi up
```

After n8n is initialized, save the encryption key to the config. This is needed to restore database from backup:

```sh
export ENCRYPTION_KEY=$(pulumi stack output --show-secrets --json | jq '.ai.n8n.encryptionKey' -r)
pulumi config set n8n:N8N_ENCRYPTION_KEY $ENCRYPTION_KEY --secret

pulumi up
```
