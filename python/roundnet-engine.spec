# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller multipackage spec for CutServe Python backend.

Produces two binaries:
  - roundnet-engine   (main.py – detection)
  - roundnet-renderer (tools/renderer.py – export)
"""

import sys
from pathlib import Path

block_cipher = None

# ── Analysis for main detection engine ──────────────────────────────────

engine_a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('../yolov8n-pose.pt', '.'),
        ('core', 'core'),
    ],
    hiddenimports=[
        'ultralytics',
        'torch',
        'cv2',
        'numpy',
        'json',
        'PIL',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
)

engine_pyz = PYZ(engine_a.pure, engine_a.zipped_data, cipher=block_cipher)

engine_exe = EXE(
    engine_pyz,
    engine_a.scripts,
    engine_a.binaries,
    engine_a.datas,
    [],
    name='roundnet-engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)

# ── Analysis for renderer ───────────────────────────────────────────────

renderer_a = Analysis(
    ['tools/renderer.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        'json',
        'subprocess',
        'shutil',
        'tempfile',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
)

renderer_pyz = PYZ(renderer_a.pure, renderer_a.zipped_data, cipher=block_cipher)

renderer_exe = EXE(
    renderer_pyz,
    renderer_a.scripts,
    renderer_a.binaries,
    renderer_a.datas,
    [],
    name='roundnet-renderer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
)
