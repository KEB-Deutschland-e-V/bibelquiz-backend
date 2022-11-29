#!/bin/bash
# Release a new Version

echo "Release a new Version"
git add .
git commit -m "$1"
npm version patch

echo "Building new Artifact"
bash build.sh
bash deploy.sh

echo "Updating on Github"
VERSION=$(jq -r '.version' package.json)
git push
git tag "$VERSION" -m "$1"
git push --tags

echo "Done."
