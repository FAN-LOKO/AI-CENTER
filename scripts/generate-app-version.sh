#!/usr/bin/env bash
set -euo pipefail

OUT_FILE="${1:-js/app-version.js}"
mkdir -p "$(dirname "$OUT_FILE")"

APP_VERSION="${APP_VERSION:-}"
if [ -z "$APP_VERSION" ]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    APP_VERSION="$(git describe --tags --abbrev=0 2>/dev/null || true)"
    APP_VERSION="${APP_VERSION#v}"
  fi
fi
APP_VERSION="${APP_VERSION:-0.1.0}"

BUILD_VERSION="${BUILD_VERSION:-}"
if [ -z "$BUILD_VERSION" ]; then
  if [ -n "${CI_PIPELINE_IID:-}" ]; then
    BUILD_VERSION="$CI_PIPELINE_IID"
  elif [ -n "${GITHUB_RUN_NUMBER:-}" ]; then
    BUILD_VERSION="$GITHUB_RUN_NUMBER"
  else
    BUILD_VERSION="$(date -u +%Y.%m.%d).1"
  fi
fi

COMMIT_HASH="${COMMIT_HASH:-}"
if [ -z "$COMMIT_HASH" ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  COMMIT_HASH="$(git rev-parse --short=8 HEAD 2>/dev/null || true)"
fi
COMMIT_HASH="${COMMIT_HASH:-null}"

BUILT_AT="${BUILT_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

if [ "$COMMIT_HASH" = "null" ]; then
  COMMIT_LINE='commitHash: null,'
else
  COMMIT_LINE="commitHash: \"$COMMIT_HASH\","
fi

cat > "$OUT_FILE" <<JS
(function initAppVersion(global) {
  const runtime = global.AICRuntime || {};
  const version = {
    appVersion: "$APP_VERSION",
    buildVersion: "$BUILD_VERSION",
    $COMMIT_LINE
    builtAt: "$BUILT_AT",
    source: "generated"
  };

  global.AICRuntime = {
    ...runtime,
    version,
    getVersionInfo() {
      return { ...version };
    }
  };
})(window);
JS

printf 'Generated %s\n' "$OUT_FILE"
printf 'appVersion=%s\n' "$APP_VERSION"
printf 'buildVersion=%s\n' "$BUILD_VERSION"
printf 'commitHash=%s\n' "$COMMIT_HASH"
printf 'builtAt=%s\n' "$BUILT_AT"
