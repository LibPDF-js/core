#!/usr/bin/env bash
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: bun run release <version>"
  echo ""
  echo "Examples:"
  echo "  bun run release 0.0.1-beta.1"
  echo "  bun run release patch"
  echo "  bun run release minor"
  echo "  bun run release major"
  exit 1
fi

VERSION_ARG="$1"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
  echo "Error: You have uncommitted changes"
  exit 1
fi

echo "Bumping version to $VERSION_ARG..."
npm version "$VERSION_ARG" --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")
TAG="v$NEW_VERSION"

echo "Committing version bump..."
git add package.json
git commit -m "release: $TAG"

echo "Creating tag $TAG..."
git tag "$TAG"

echo "Pushing branch and tag to origin..."
git push && git push origin "$TAG"

echo ""
echo "Done! Released $TAG"
echo "GitHub Actions will now:"
echo "  1. Create a GitHub Release"
echo "  2. Publish to npm"
