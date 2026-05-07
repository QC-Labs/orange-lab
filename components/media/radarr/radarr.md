# Radarr

|               |                                                                  |
| ------------- | ---------------------------------------------------------------- |
| Homepage      | https://radarr.video/                                            |
| Documentation | https://wiki.servarr.com/en/radarr                               |
| Docker Image  | https://docs.linuxserver.io/images/docker-radarr/                |

Movie collection manager. Integrates with Usenet and BitTorrent to acquire movies and manage your library.

Radarr mounts the host media directory at `/media`. This must point to the same host directory used by [Jellyfin](../jellyfin/jellyfin.md) and [Sonarr](../sonarr/sonarr.md) so all apps can access the same files.

```sh
# Enable Radarr
pulumi config set radarr:enabled true
# Mount media volume, same as used by Jellyfin
pulumi config set radarr:media/hostPath /mnt/media

# (Recommended) Use specified Longhorn volume for config
pulumi config set radarr:fromVolume radarr

pulumi up
```

## Post-Installation

**Get URL and API key from stack outputs:**

After deployment, access Radarr at the endpoint URL and complete these steps in order:

1. **Authentication** — on first access, complete the setup modal (or later via Settings → General → Security): set Authentication to Forms and create an admin user
2. **Root folder** — Settings → Media Management → Root Folders → add `/media/movies`
3. **Library Import** — Movies → Library Import → select `/media/movies` to scan and import existing movie files
4. **Download client** — Settings → Download Clients → add [Transmission](../transmission/transmission.md#arr-stack-integration)
5. **Indexers** — Settings → Indexers → add indexers, or use [Prowlarr](../prowlarr/prowlarr.md) to sync indexers automatically
6. **API key** — Settings → General → Security → API Key (needed for [Seerr](../seerr/seerr.md) and [Prowlarr](../prowlarr/prowlarr.md))

## Optional settings

Settings -> Indexers -> Options -> Maximum size
Settings -> Media Management -> File Management -> Unmonitor Deleted Movies
