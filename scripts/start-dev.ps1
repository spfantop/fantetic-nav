$ErrorActionPreference = "Stop"

# Ensure UTF-8 output to avoid console encoding issues.
chcp 65001 | Out-Null

# Resolve paths relative to this script.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "[Prep] Building root public/ first for Go embed..."
powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir "build-public.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "build-public.ps1 failed with exit code $LASTEXITCODE"
}

Write-Host "[Run] Starting backend service: http://localhost:6412"
Push-Location $repoRoot
try {
    go run .
}
finally {
    Pop-Location
}
