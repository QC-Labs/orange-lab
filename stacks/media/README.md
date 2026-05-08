# Media Stack

Media management, photo storage, and media streaming applications.

**Prerequisite**: Core stack must be deployed first (network, storage, and data operators).

## Deploy

```sh
cd stacks/media
pulumi stack init lab-media
pulumi up --stack lab-media
```

## Configure Applications

### Immich

```sh
pulumi config set --stack lab-media immich:enabled true
pulumi config set --stack lab-media immich:machine-learning/enabled true
pulumi up --stack lab-media
```

### Jellyfin + *arr Stack

```sh
pulumi config set --stack lab-media jellyfin:enabled true
pulumi up --stack lab-media
```

### Movies/TV Stack

```sh
pulumi config set --stack lab-media seerr:enabled true
pulumi config set --stack lab-media radarr:enabled true
pulumi config set --stack lab-media radarr:media/hostPath /mnt/media
pulumi config set --stack lab-media sonarr:enabled true
pulumi config set --stack lab-media sonarr:media/hostPath /mnt/media
pulumi config set --stack lab-media transmission:enabled true
pulumi config set --stack lab-media prowlarr:enabled true
pulumi up --stack lab-media
```

### Music Stack

```sh
pulumi config set --stack lab-media musicseerr:enabled true
pulumi config set --stack lab-media lidarr:enabled true
pulumi config set --stack lab-media lidarr:media/hostPath /mnt/media
pulumi config set --stack lab-media transmission:enabled true
pulumi config set --stack lab-media prowlarr:enabled true
pulumi up --stack lab-media
```

## Components

- [Immich](./apps/immich/immich.md) — Self-hosted photo and video backup solution
- [Jellyfin](./apps/jellyfin/jellyfin.md) — Streaming movies, TV shows and music
- [Lidarr](./apps/lidarr/lidarr.md) — Music collection manager
- [MusicSeerr](./apps/musicseerr/musicseerr.md) — Music discovery and request management
- [Prowlarr](./apps/prowlarr/prowlarr.md) — Indexer manager for the *arr ecosystem
- [Radarr](./apps/radarr/radarr.md) — Movie collection manager
- [Seerr](./apps/seerr/seerr.md) — Media discovery
- [Sonarr](./apps/sonarr/sonarr.md) — TV show collection manager
- [Transmission](./apps/transmission/transmission.md) — BitTorrent download client
