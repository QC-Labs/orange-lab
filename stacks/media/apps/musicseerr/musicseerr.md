# MusicSeerr

|               |                                                                  |
| ------------- | ---------------------------------------------------------------- |
| Homepage      | https://musicseerr.com/                                          |
| Documentation | https://musicseerr.com/docs                                      |
| Docker Image  | https://github.com/habirabbu/musicseerr/pkgs/container/musicseerr |

Music request and discovery platform. Connects Lidarr, Jellyfin, ListenBrainz, and Last.fm into a single interface for browsing, requesting, and playing music.

MusicSeerr depends on [Lidarr](../lidarr/lidarr.md) for music library management and requests and [Jellyfin](../jellyfin/jellyfin.md) for playback.

```sh
# Enable MusicSeerr (requires Lidarr)
pulumi config set musicseerr:enabled true

# (Recommended) Use specified Longhorn volume for config
pulumi config set musicseerr:fromVolume musicseerr

pulumi up
```

## Post-Installation

After deployment, access MusicSeerr at the endpoint URL and complete these steps:

**Get URLs from stack outputs:**

```sh
# Show MusicSeerr endpoint
pulumi stack output --show-secrets --json | jq -r '.media.endpoints.musicseerr'

# Show cluster endpoints (needed for configuration)
pulumi stack output --show-secrets --json | jq -r '.media.clusterUrls.lidarr'
pulumi stack output --show-secrets --json | jq -r '.media.clusterUrls.jellyfin'
```

### 1. Lidarr Connection (required)

At **Settings → Lidarr**, add your Lidarr server:

- **Hostname**: use the cluster URL (e.g., `http://lidarr.lidarr:8686`)
- **API Key**: from Lidarr → Settings → General → Security → API Key
- **Root Folder**: `/media/music`
- Click **Test**, then **Save**

Once connected, MusicSeerr will sync your Lidarr library automatically.

### 2. Jellyfin Playback Source (optional)

For in-app music playback, add Jellyfin at **Settings → Playback Sources → Jellyfin**:

- **Hostname**: use the cluster URL (e.g., `http://jellyfin.jellyfin:8096`)
- **API Key**: from Jellyfin → Administration → API Keys
- Click **Test**, then **Save**

### 3. Scrobbling (optional)

At **Settings → Scrobbling**, connect:

- **ListenBrainz**: Enter your username and token for tracking listening history and recommendations
- **Last.fm**: Enter your API credentials for dual scrobbling

### 4. Library Sync

Once configured, click **Start Sync** on the home page or wait for automatic sync to complete. Your Lidarr library will appear in MusicSeerr for browsing and requesting.
