# slskd

|                |                                                                     |
| -------------- | ------------------------------------------------------------------- |
| Homepage       | https://slskd.org/                                                  |
| Source code    | https://github.com/slskd/slskd                                      |
| Configuration  | https://github.com/slskd/slskd/blob/master/docs/config.md           |
| Config example | https://github.com/slskd/slskd/blob/master/config/slskd.example.yml |
| Docker Image   | https://hub.docker.com/r/slskd/slskd                                |
| Endpoints      | `https://slskd.<domain>/`                                           |

Modern Soulseek client. DroppedNeedle uses slskd as its download client: it searches and enqueues downloads through slskd's local HTTP API, then imports finished files into the music library.

```sh
# Enable slskd
pulumi config set slskd:enabled true

# Mount media volume, same as used by DroppedNeedle
pulumi config set slskd:media/hostPath /mnt/media
# Host volumes require pods to run on specific host
pulumi config set slskd:requiredNodeLabel kubernetes.io/hostname=<host>

# (Recommended) Use specified Longhorn volume for config
pulumi config set slskd:fromVolume slskd

# (Optional) Web UI password is auto-generated; set manually to keep stable across backup/restore:
pulumi config set --secret slskd:web/password <password>

# (Optional) Soulseek credentials are auto-generated; set manually to keep stable:
pulumi config set slskd:soulseek/username <username>
pulumi config set --secret slskd:soulseek/password <password>

# (Optional) modify media folders used for downloaded files as well as what is shared
# Note: Both should be on same volume (media) for atomic imports to work
pulumi config set slskd:SLSKD_DOWNLOADS_DIR /media/slskd-downloads
# Soulseek is a reciprocal network; slskd needs at least one shared folder to search and download
pulumi config set slskd:SLSKD_SHARED_DIR "/media/music;/media/movies"

pulumi up
```

## Post-Installation

After deployment, access slskd at the endpoint URL and complete steps below if needed.

### 1. Web Authentication

Log in with username `slskd`. The default password is auto-generated. To persist the value so it's also used after backup/restore:

```sh
PASSWORD=$(pulumi stack output --show-secrets --json | jq -r '.apps.slskd.webPassword')

pulumi config set --secret slskd:web/password $PASSWORD
```

`SLSKD_REMOTE_CONFIGURATION` is set to `false`, so web UI settings are not persisted — all configuration is managed through environment variables.

### 2. Soulseek Account

By default SoulSeek username and password are auto-generated. You can use your own credentials or persist the generated values so they are used after restore:

```sh
USERNAME=$(pulumi stack output --show-secrets --json | jq -r '.apps.slskd.soulseekUsername')
PASSWORD=$(pulumi stack output --show-secrets --json | jq -r '.apps.slskd.soulseekPassword')

pulumi config set slskd:soulseek/username $USERNAME
pulumi config set --secret slskd:soulseek/password $PASSWORD
```

### 3. DroppedNeedle Integration

Add slskd to DroppedNeedle under **Settings → Download Client**:

- **URL**: `http://slskd.slskd:5030`
- **API Key**: the auto-generated key from stack outputs (`.apps.slskd.apiKey`)
- **Downloads path**: `/media/slskd-downloads` (pre-configured via `SLSKD_DOWNLOADS_PATH`)
