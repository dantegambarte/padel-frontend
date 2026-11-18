#!/usr/bin/env bash
# Uploads the hidden source maps of a production build to Sentry, then deletes
# every .map file from the deploy output so they are never published.
#
# Opt-in: does nothing (except deleting the maps) unless SENTRY_AUTH_TOKEN,
# SENTRY_ORG and SENTRY_PROJECT are set. Run it after `pnpm run build` and
# before copying dist/padel-frontend/browser/ to the server.
#
# Release = git SHA (override with SENTRY_RELEASE). It must match
# `release` in environment.prod.ts so events resolve to these maps.
set -euo pipefail

OUT_DIR="${1:-dist/padel-frontend/browser}"
RELEASE="${SENTRY_RELEASE:-$(git rev-parse HEAD)}"

if [ ! -d "$OUT_DIR" ]; then
  echo "Build output not found: $OUT_DIR (run pnpm run build first)" >&2
  exit 1
fi

if [ -n "${SENTRY_AUTH_TOKEN:-}" ] && [ -n "${SENTRY_ORG:-}" ] && [ -n "${SENTRY_PROJECT:-}" ]; then
  echo "Uploading source maps to Sentry for release $RELEASE"
  # Debug IDs link each bundle to its map even if the release does not match.
  pnpm exec sentry-cli sourcemaps inject "$OUT_DIR"
  pnpm exec sentry-cli releases new "$RELEASE"
  pnpm exec sentry-cli sourcemaps upload --release "$RELEASE" "$OUT_DIR"
  pnpm exec sentry-cli releases finalize "$RELEASE"
else
  echo "SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT not set: skipping upload"
fi

find "$OUT_DIR" -name '*.map' -type f -delete
echo "Removed source maps from $OUT_DIR"
