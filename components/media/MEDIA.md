# Media module

Components for media management, photo storage and media streaming.

## Quick Start

### Immich

```sh
pulumi config set immich:enabled true
pulumi config set immich:machine-learning/enabled true
pulumi up
```

### Jellyfin

```sh
pulumi config set jellyfin:enabled true
pulumi up
```

## Components

- [Immich](./immich/immich.md) - Self-hosted photo and video backup solution
- [Jellyfin](./jellyfin/jellyfin.md) - Streaming movies, TV shows and music
