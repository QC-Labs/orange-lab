#!/bin/bash

# Upload files to Jellyfin media volume using kubectl cp.
# Usage: jellyfin-upload.sh <source> <destination-path>
#
# Examples:
#   jellyfin-upload.sh "~/Downloads/*.mkv" "/media/movies/"
#   jellyfin-upload.sh "./movie.mp4" "/media/movies/"
#   jellyfin-upload.sh "~/TV/*.mkv" "/media/shows/"
#
# kubectl cp natively supports wildcards in the source path.

set -euo pipefail

SOURCE="${1:-}"
DEST_PATH="${2:-}"
APP="jellyfin"
NAMESPACE="jellyfin"

if [ -z "$SOURCE" ] || [ -z "$DEST_PATH" ]; then
    echo "Usage: $0 <source> <destination-path>"
    exit 1
fi

POD=$(kubectl get pod -n "$NAMESPACE" -l "app.kubernetes.io/name=$APP" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) || true

if [ -z "$POD" ]; then
    echo "Error: No running Jellyfin pod found in namespace $NAMESPACE"
    exit 1
fi

kubectl cp "$SOURCE" "$NAMESPACE/$POD:$DEST_PATH"
