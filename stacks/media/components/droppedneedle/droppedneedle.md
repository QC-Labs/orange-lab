# DroppedNeedle

|               |                                                                         |
| ------------- | ----------------------------------------------------------------------- |
| Homepage      | https://www.droppedneedle.com/                                          |
| Source code   | https://github.com/HabiRabbu/DroppedNeedle                              |
| Documentation | https://droppedneedle.com/docs                                          |
| Configuration | https://droppedneedle.com/docs/configuration                            |
| Docker Image  | https://hub.docker.com/r/droppedneedle/droppedneedle                 |
| Endpoints     | `https://droppedneedle.<domain>/`                                       |

Self-hosted music request, discovery, and library management app. It scans, tags, fingerprints, and organises your music library natively, and drives downloads through slskd (Soulseek). Gives a Spotify-like UI for your music library. Listen through web or mobile apps with OpenSubsonic and Jellyfin APIs compatibility.

DroppedNeedle depends on [slskd](../slskd/slskd.md) for downloads and integrates with [Jellyfin](../jellyfin/jellyfin.md).

```sh
# Enable DroppedNeedle (requires slskd)
pulumi config set droppedneedle:enabled true

# Mount media volume, same as used by slskd/Jellyfin
pulumi config set droppedneedle:media/hostPath /mnt/media
# Host volumes require pods to run on specific host
pulumi config set droppedneedle:requiredNodeLabel kubernetes.io/hostname=<host>

# (Recommended) Use specified Longhorn volume for config
pulumi config set droppedneedle:fromVolume droppedneedle

pulumi up
```

## Post-Installation

After deployment, access DroppedNeedle at the endpoint URL and complete these steps:

### 1. Admin Account

On first launch, create an admin account (username and password; email optional). Save the password in your password manager.

### 2. Library and Scan

Go to **Settings → Library**, add your library path, and scan:

- **Path**: `/media/music` (replace the default `/music`)
- Click **Save**, then **Scan**

DroppedNeedle walks your music folder, identifies files, and populates the library. Files that can't be confidently identified go into a manual-review queue. Downloaded files are imported into this path using atomic moves from the `SLSKD_DOWNLOADS_PATH` (default `/media/slskd-downloads`).

(Optional) Add an **AcoustID API key** on the same page to enable Tier-3 fingerprint identification for files without MusicBrainz tags. Get a key at [acoustid.org/api-key](https://acoustid.org/api-key).

### 3. Download Client — slskd

At **Settings → Download Client**, add your slskd server:

- **URL**: `http://slskd.slskd:5030`
- **API Key**: retrieve the auto-generated key with `pulumi stack output --show-secrets --json | jq -r '.apps.slskd.apiKey'`
- Click **Test**, then **Save**

### 4. (Optional) Connect Apps

Enable OpenSubsonic and/or Jellyfin APIs at **Settings → Connect Apps** and create per-app passwords so mobile clients can stream your library. Each user manages their own connections.

### 5. (Optional) Jellyfin

Connect Jellyfin at **Settings → Jellyfin** for both login (Jellyfin users can sign into DroppedNeedle) and playback. First prepare Jellyfin:

- Create a **DroppedNeedle** account in Jellyfin → Administration → Users
- Create an API key in Jellyfin → Administration → API Keys

Then in DroppedNeedle:

- **URL**: `http://jellyfin.jellyfin:8096`
- **API Key**: the key you created above
- Click **Test**, then **Save**

### 6. (Optional) YouTube

Add an API key at **Settings → YouTube** to enable auto-generated preview links for albums not in your library. Instructions are on the page.

### 7. (Optional) Scrobbling

**ListenBrainz (recommended, open source)** — no admin setup needed. Each user goes to **Profile → Scrobbling & Discovery** and pastes their token from [listenbrainz.org/profile](https://listenbrainz.org/profile).

**Last.fm (optional)** — requires admin setup. Register an app at [last.fm/api/account/create](https://www.last.fm/api/account/create), then add the app key and shared secret at **Settings → Last.fm**. Each user can then connect their Last.fm account from **Profile → Scrobbling & Discovery**.

### 8. (Optional) Spotify

Add client ID and secret at **Settings → Spotify** for playlist import. Each user can then import and sync their Spotify playlists.

### 9. (Optional) Live Events

Add Ticketmaster and Skiddle API keys (both free) at **Settings → Live Events**. Each user picks the cities they want to watch from their profile.
