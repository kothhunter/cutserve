#!/bin/bash
# Build the Python backend into standalone binaries using PyInstaller.
# Output: python/dist/roundnet-engine and python/dist/roundnet-renderer

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR="$SCRIPT_DIR/.venv-build"

# Create a build venv if needed
if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating build virtualenv..."
  python3 -m venv "$VENV_DIR"
fi

echo "==> Activating venv and installing dependencies..."
source "$VENV_DIR/bin/activate"
pip install -q -r requirements.txt
pip install -q pyinstaller

echo "==> Running PyInstaller..."
pyinstaller --clean --noconfirm roundnet-engine.spec

echo ""
echo "Build complete. Binaries:"
echo "  $SCRIPT_DIR/dist/roundnet-engine"
echo "  $SCRIPT_DIR/dist/roundnet-renderer"

# Quick smoke test
if [ -f "$SCRIPT_DIR/dist/roundnet-engine" ]; then
  echo ""
  echo "==> Smoke test (roundnet-engine --help):"
  "$SCRIPT_DIR/dist/roundnet-engine" --help 2>&1 | head -5 || true
fi
