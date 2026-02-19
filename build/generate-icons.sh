#!/bin/bash
# Generate macOS .icns and a 256x256 PNG icon from the SVG logo.
# Requires macOS (uses qlmanage, sips, iconutil).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SVG="$PROJECT_ROOT/public/logo/CUT.svg"
BUILD_DIR="$SCRIPT_DIR"
ICONSET_DIR="$BUILD_DIR/icon.iconset"
TMP_PNG="$BUILD_DIR/_tmp_1024.png"

if [ ! -f "$SVG" ]; then
  echo "ERROR: SVG not found at $SVG"
  exit 1
fi

echo "==> Converting SVG to 1024x1024 PNG..."
# qlmanage generates a thumbnail from the SVG
qlmanage -t -s 1024 -o "$BUILD_DIR" "$SVG" >/dev/null 2>&1
# qlmanage names the output <filename>.svg.png
mv "$BUILD_DIR/CUT.svg.png" "$TMP_PNG"

echo "==> Creating .iconset with required sizes..."
mkdir -p "$ICONSET_DIR"

# Required icon sizes for macOS .icns
for size in 16 32 128 256 512; do
  sips -z $size $size "$TMP_PNG" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double "$TMP_PNG" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done

echo "==> Building .icns..."
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"

echo "==> Creating 256x256 icon.png for Windows/Linux..."
sips -z 256 256 "$TMP_PNG" --out "$BUILD_DIR/icon.png" >/dev/null

# Cleanup
rm -rf "$ICONSET_DIR" "$TMP_PNG"

echo "Done! Generated:"
echo "  $BUILD_DIR/icon.icns"
echo "  $BUILD_DIR/icon.png"
