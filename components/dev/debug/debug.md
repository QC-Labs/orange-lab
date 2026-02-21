# Debug (experimental)

Utility containers for troubleshooting the cluster.

Available settings described in source code - [debug.ts](./debug.ts).

Generally keep it disabled but there are few cases when it's useful:

- access a detached Longhorn volume (f.e. cloned or restored from backup)
- access a snapshot of currently attached volume (when active pod doesn't have shell available)
- copy volume contents to local folder
- use export job to create archive with volume contents to USB drive
