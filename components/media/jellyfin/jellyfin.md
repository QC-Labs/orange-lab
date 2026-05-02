# Jellyfin

|                       |                                              |
| --------------------- | -------------------------------------------- |
| Homepage              | https://jellyfin.org/                        |
| Source code           | https://github.com/jellyfin/jellyfin         |
| Documentation         | https://jellyfin.org/docs/                   |
| Endpoints             | `https://jellyfin.<domain>/`                 |

Free Software Media System. Streaming movies, TV shows and music.

```sh
# Enable Jellyfin
pulumi config set jellyfin:enabled true

# Use restored Longhorn volume for config
pulumi config set jellyfin:fromVolume jellyfin

# (Optional) Increase media storage size
pulumi config set jellyfin:media/storageSize 100Gi

# (Optional) Mount local media directory
pulumi config set jellyfin:localMedia/enabled true
pulumi config set jellyfin:localMedia/path /mnt/media

pulumi up
```

## Media Library Setup

After deployment, access Jellyfin at the endpoint URL and complete the initial setup wizard. During setup:

1. Create an admin user
2. Add media libraries pointing to `/media` (Longhorn volume) or `/media-local` (if localMedia is enabled)
3. Configure metadata providers and other settings as desired

## Hardware Acceleration

Jellyfin supports hardware transcoding with NVIDIA and AMD GPUs. To enable:

1. Install the appropriate GPU operator from the [Hardware module](../../hardware/HARDWARE.md)
2. Set the GPU type for Jellyfin:

```sh
pulumi config set jellyfin:gpu nvidia
# or
pulumi config set jellyfin:gpu amd
```
