# Build the Python backend into standalone binaries using PyInstaller (Windows).
# Output: python/dist/roundnet-engine.exe and python/dist/roundnet-renderer.exe

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvDir = Join-Path $ScriptDir ".venv-build"

# Create a build venv if needed
if (-not (Test-Path $VenvDir)) {
    Write-Host "==> Creating build virtualenv..."
    python -m venv $VenvDir
}

Write-Host "==> Activating venv and installing dependencies..."
& "$VenvDir\Scripts\Activate.ps1"
pip install -q -r requirements.txt
pip install -q pyinstaller

Write-Host "==> Running PyInstaller..."
pyinstaller --clean --noconfirm roundnet-engine.spec

Write-Host ""
Write-Host "Build complete. Binaries:"
Write-Host "  $ScriptDir\dist\roundnet-engine.exe"
Write-Host "  $ScriptDir\dist\roundnet-renderer.exe"

# Quick smoke test
$EnginePath = Join-Path $ScriptDir "dist\roundnet-engine.exe"
if (Test-Path $EnginePath) {
    Write-Host ""
    Write-Host "==> Smoke test (roundnet-engine.exe --help):"
    & $EnginePath --help 2>&1 | Select-Object -First 5
}
