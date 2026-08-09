# Lidarr

|               |                                                   |
| ------------- | ------------------------------------------------- |
| Homepage      | https://lidarr.audio/                             |
| Documentation | https://wiki.servarr.com/en/lidarr                |
| Docker Image  | https://docs.linuxserver.io/images/docker-lidarr/ |

Music collection manager. Integrates with Transmission BitTorrent client to acquire music and manage your library.

**Note:** Lidarr was required by Musicseerr but after move to DroppedNeedle it's not currently used.

Lidarr mounts the shared media storage configured in the [Media stack README](../../README.md) at `/media`.

```sh
# Configure Media profile
pulumi config set lidarr:media jellyfin-media

# Enable Lidarr
pulumi config set lidarr:enabled true
# Required when using media:hostPath
pulumi config set lidarr:requiredNodeLabel kubernetes.io/hostname=<host>
# (Recommended) Use specified Longhorn volume for config
pulumi config set lidarr:fromVolume lidarr

pulumi up
```

## Post-Installation

**Get URL and API key from stack outputs:**

After deployment, access Lidarr at the endpoint URL and complete these steps in order:

1. **Authentication** — on first access, complete the setup modal (or later via Settings → General → Security): set Authentication to Forms and create an admin user
2. **Root folder** — Settings → Media Management → Root Folders → add `/media/music`
3. **Library Import** — Library → Import → select `/media/music` to scan and import existing music files
4. **Download client** — Settings → Download Clients → add [Transmission](../transmission/transmission.md#arr-stack-integration)
5. **Indexers** — Settings → Indexers → add indexers, or use [Prowlarr](../prowlarr/prowlarr.md) to sync indexers automatically
6. **API key** — Settings → General → Security → API Key
