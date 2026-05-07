# Media module

Components for media management, photo storage and media streaming.

## Quick Start

### Immich

```sh
pulumi config set immich:enabled true
pulumi config set immich:machine-learning/enabled true
pulumi up
```

### Jellyfin + \*arr stack

```sh
pulumi config set jellyfin:enabled true
pulumi up

# Configure Seerr/Musicseerr and their dependencies
```

### Movies/TV stack

```sh
# Seerr media discovery
pulumi config set seerr:enabled true

# Radaar movie collection manager
pulumi config set radarr:enabled true
pulumi config set radarr:media/hostPath /mnt/media
# Sonaar TV shows collection manager
pulumi config set sonarr:enabled true
pulumi config set sonarr:media/hostPath /mnt/media

# Used by Radarr and Sonarr to download Torrent content
pulumi config set transmission:enabled true
# (Optional) Manages indexers to be pushed to Radarr and Sonarr
pulumi config set prowlarr:enabled true

pulumi up
```

### Music stack

```sh
# MusicSeerr music discovery
pulumi config set musicseerr:enabled true

# Lidarr music collection manager
pulumi config set lidarr:enabled true
pulumi config set lidarr:media/hostPath /mnt/media

# Used by Lidaar to download Torrent content
pulumi config set transmission:enabled true
# (Optional) Manages indexers to be pushed to Lidaar
pulumi config set prowlarr:enabled true

pulumi up
```

## Components

- [Immich](./immich/immich.md) - Self-hosted photo and video backup solution
- [Jellyfin](./jellyfin/jellyfin.md) - Streaming movies, TV shows and music
- [Lidarr](./lidarr/lidarr.md) - Music collection manager
- [MusicSeerr](./musicseerr/musicseerr.md) - Music discovery and request management
- [Prowlarr](./prowlarr/prowlarr.md) - Indexer manager for the *arr ecosystem
- [Radarr](./radarr/radarr.md) - Movie collection manager
- [Seerr](./seerr/seerr.md) - Media discovery
- [Sonarr](./sonarr/sonarr.md) - TV show collection manager
- [Transmission](./transmission/transmission.md) - BitTorrent download client
