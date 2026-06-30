#!/bin/bash
# Release script for the @orangelab/pulumi package.
# Bumps version in root and packages/pulumi/package.json, commits, and creates a git tag.
# Usage: npm run release <version> (e.g. npm run release 0.6.0)
set -e

VERSION=${1:?Usage: npm run release <version>}

# Guard: fail if working directory has uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Error: Working directory has uncommitted changes"
    exit 1
fi

# Bump both version fields explicitly
sed -i 's/"version": ".*"/"version": "'"$VERSION"'"/' package.json
sed -i 's/"version": ".*"/"version": "'"$VERSION"'"/' packages/pulumi/package.json

# Commit and tag
git add package.json packages/pulumi/package.json
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"

echo "Released v$VERSION. Run: git push && git push --tags && npm run publish"
