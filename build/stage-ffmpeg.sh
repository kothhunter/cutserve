#!/bin/bash
# Copy static ffmpeg + ffprobe binaries from node_modules into vendor/ffmpeg/
# so electron-builder can bundle them as extraResources.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_ROOT/vendor/ffmpeg"

mkdir -p "$VENDOR_DIR"

# ffmpeg-static stores the binary at the package root
FFMPEG_SRC="$PROJECT_ROOT/node_modules/ffmpeg-static/ffmpeg"
if [ ! -f "$FFMPEG_SRC" ]; then
  echo "ERROR: ffmpeg-static binary not found. Run 'npm install' first."
  exit 1
fi

# ffprobe-static stores binaries under bin/<platform>/<arch>/
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  arm64|aarch64) ARCH_DIR="arm64" ;;
  x86_64)        ARCH_DIR="x64" ;;
  *)             ARCH_DIR="$ARCH" ;;
esac

FFPROBE_SRC="$PROJECT_ROOT/node_modules/ffprobe-static/bin/${PLATFORM}/${ARCH_DIR}/ffprobe"
if [ ! -f "$FFPROBE_SRC" ]; then
  # Try alternate path format
  FFPROBE_SRC="$PROJECT_ROOT/node_modules/ffprobe-static/bin/${PLATFORM}/$(uname -m)/ffprobe"
fi

if [ ! -f "$FFPROBE_SRC" ]; then
  echo "WARNING: ffprobe-static binary not found at expected path. Skipping ffprobe."
  echo "  Looked for: $PROJECT_ROOT/node_modules/ffprobe-static/bin/${PLATFORM}/${ARCH_DIR}/ffprobe"
else
  cp "$FFPROBE_SRC" "$VENDOR_DIR/ffprobe"
  chmod +x "$VENDOR_DIR/ffprobe"
  echo "Staged: ffprobe → vendor/ffmpeg/ffprobe"
fi

cp "$FFMPEG_SRC" "$VENDOR_DIR/ffmpeg"
chmod +x "$VENDOR_DIR/ffmpeg"
echo "Staged: ffmpeg → vendor/ffmpeg/ffmpeg"

echo "Done! vendor/ffmpeg/ contents:"
ls -lh "$VENDOR_DIR/"
