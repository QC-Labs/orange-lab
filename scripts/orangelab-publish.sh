#!/bin/bash
# Build and publish the @orangelab/pulumi package to npm.
# Used locally or by GitHub Actions triggered on git tags.
# Usage: npm run publish
set -e
npm run build -w @orangelab/pulumi
npm publish -w @orangelab/pulumi
