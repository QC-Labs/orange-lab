# Media Stack

Media management, photo storage, and media streaming applications.

**Prerequisite**: Core stack must be deployed first (network, storage, and data operators).

## Components

- [DroppedNeedle](./components/droppedneedle/droppedneedle.md) — Self-hosted music discovery, requests, and native library engine
- [Immich](./components/immich/immich.md) — Self-hosted photo and video backup solution
- [Jellyfin](./components/jellyfin/jellyfin.md) — Streaming movies, TV shows and music
- [Lidarr](./components/lidarr/lidarr.md) — Music collection manager
- [Prowlarr](./components/prowlarr/prowlarr.md) — Indexer manager for the \*arr ecosystem
- [Radarr](./components/radarr/radarr.md) — Movie collection manager
- [Seerr](./components/seerr/seerr.md) — Media discovery
- [slskd](./components/slskd/slskd.md) — Soulseek download client for DroppedNeedle
- [Sonarr](./components/sonarr/sonarr.md) — TV show collection manager
- [Transmission](./components/transmission/transmission.md) — BitTorrent download client

## Deploy

```sh
cd stacks/media
pulumi stack init lab-media
pulumi up
```

## Configure Applications

### Immich

```sh
# Confirm cloudnative-pg from root stack is installed
pulumi config set cloudnative-pg:enabled true

pulumi config set immich:enabled true
pulumi config set immich:machine-learning/enabled true
pulumi up
```

### Jellyfin + \*arr Stack

```sh
pulumi config set jellyfin:enabled true
pulumi up
```

#### Seerr - Movies/TV

```sh
pulumi config set seerr:enabled true
pulumi config set radarr:enabled true
pulumi config set radarr:media/hostPath /mnt/media
pulumi config set sonarr:enabled true
pulumi config set sonarr:media/hostPath /mnt/media
pulumi config set transmission:enabled true
pulumi config set prowlarr:enabled true
pulumi up
```

#### DroppedNeedle + slskd - Music

```sh
pulumi config set droppedneedle:enabled true
pulumi config set droppedneedle:media/hostPath /mnt/<drive>/media
pulumi config set droppedneedle:requiredNodeLabel kubernetes.io/hostname=<host>
pulumi config set slskd:enabled true
pulumi config set slskd:media/hostPath /mnt/<drive>/media
pulumi config set slskd:requiredNodeLabel kubernetes.io/hostname=<host>
pulumi up
```
