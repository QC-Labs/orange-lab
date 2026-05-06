# Jellyfin

|                       |                                              |
| --------------------- | -------------------------------------------- |
| Homepage              | https://jellyfin.org/                        |
| Source code           | https://github.com/jellyfin/jellyfin         |
| Documentation         | https://jellyfin.org/docs/                   |
| Endpoints             | `https://jellyfin.<domain>/`                 |

Free Software Media System. Streaming movies, TV shows and music.

Jellyfin shares the host media directory with [Radarr](../radarr/radarr.md), [Sonarr](../sonarr/sonarr.md), and [Transmission](../transmission/transmission.md). All apps must point to the same `media/hostPath` and run on the same node.

```sh
# Deploy Jellyfin to my-host using /mnt/media as media folder
pulumi config set jellyfin:enabled true
pulumi config set jellyfin:media/hostPath /mnt/media
pulumi config set jellyfin:requiredNodeLabel kubernetes.io/hostname=my-host

# Use specified Longhorn volume as data volume
pulumi config set jellyfin:fromVolume jellyfin

pulumi up
```

## Post-Installation

After deployment, access Jellyfin at `https://jellyfin.<domain>/` and complete the setup wizard:

1. Create a root user
2. Add media libraries: Movies (`/media/movies`), Shows (`/media/shows`), etc.

### Seerr Integration

Create a dedicated Jellyfin user for Seerr at Dashboard → Users (`https://jellyfin.<domain>/`):

1. Add a user (e.g., `seerr`) with a password
2. Enable "Allow this user to manage the server"
3. Grant access to all libraries

An existing admin user works but a dedicated user is recommended.

## Hardware Acceleration

Jellyfin supports hardware transcoding with NVIDIA and AMD GPUs. To enable:

1. Install the appropriate GPU operator from the [Hardware module](../../hardware/HARDWARE.md)
2. Set the GPU type for Jellyfin:

```sh
pulumi config set jellyfin:gpu nvidia
# or
pulumi config set jellyfin:gpu amd
```

3. Enable hardware acceleration in Jellyfin UI at Dashboard → Playback → Transcoding:
   - Set **Hardware acceleration** to `NVIDIA NVENC` or `AMD AMF`
   - Enable all relevant codecs for your GPU

## Permissions/SELinux

The deployment includes an init container that creates necessary directories and sets ownership. However, if you're running SELinux, you may need to set the container context on the host directory:

```sh
semanage fcontext -a -t container_file_t '/mnt/media(/.*)?'
restorecon -R /mnt/media
```
