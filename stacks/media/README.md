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

## Media Storage

Jellyfin-related applications can use app-specific storage or share a named media profile. Immich and the other applications that do not mount the media volume are unaffected.

### App-specific storage

For a Longhorn volume used by one application:

```sh
pulumi config set jellyfin:media/fromVolume jellyfin
pulumi config set jellyfin:media/storageSize 1000Gi
```

For a host path used by one application:

```sh
pulumi config set jellyfin:media/hostPath /mnt/<drive>/media
pulumi config set jellyfin:requiredNodeLabel kubernetes.io/hostname=<host>
```

### Shared profile (recommended)

```sh
pulumi config set jellyfin:media jellyfin-media
pulumi config set jellyfin-media:fromVolume jellyfin-media
pulumi config set jellyfin-media:storageSize 1000Gi
```

Set the same `app:media` profile reference for each Jellyfin-related application that should share the volume. Use a different profile name when an application needs separate storage.

For a shared host path profile:

```sh
pulumi config set jellyfin-media:hostPath /mnt/<drive>/media
```

When using a host path, configure `<app>:requiredNodeLabel` so each application runs on the node containing the path.

App-specific settings take precedence over a selected profile. When both `fromVolume` and `hostPath` resolve, `fromVolume` takes precedence for most applications; Jellyfin mounts both.

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
pulumi config set sonarr:enabled true
pulumi config set transmission:enabled true
pulumi config set prowlarr:enabled true
pulumi up
```

#### DroppedNeedle + slskd - Music

```sh
pulumi config set droppedneedle:enabled true
pulumi config set slskd:enabled true
pulumi up
```
