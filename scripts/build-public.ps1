$ErrorActionPreference = "Stop"

# Ensure UTF-8 output to avoid console encoding issues.
chcp 65001 | Out-Null

# Resolve paths relative to this script.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$uiDir = Join-Path $repoRoot "ui"
$buildDir = Join-Path $uiDir "build"
$publicDir = Join-Path $repoRoot "public"

function Invoke-Pnpm {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]] $Args
    )

    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        & pnpm @Args
    }
    elseif (Get-Command corepack -ErrorAction SilentlyContinue) {
        & corepack pnpm @Args
    }
    else {
        throw "Neither pnpm nor corepack is available in PATH."
    }

    if ($LASTEXITCODE -ne 0) {
        throw "pnpm command failed: $($Args -join ' ')"
    }
}

Write-Host "[1/4] Installing frontend dependencies..."
Push-Location $uiDir
try {
    Invoke-Pnpm install --config.confirmModulesPurge=false

    # Rebuild every time to keep root public/ in sync with ui/build.
    Write-Host "[2/4] Building frontend assets..."
    Invoke-Pnpm build
}
finally {
    Pop-Location
}

if (-not (Test-Path $buildDir)) {
    throw "Frontend build failed: missing $buildDir"
}

# Replace root public/ with latest ui/build output.
Write-Host "[3/4] Syncing assets to root public/..."
if (Test-Path $publicDir) {
    Remove-Item -LiteralPath $publicDir -Recurse -Force
}
New-Item -ItemType Directory -Path $publicDir | Out-Null
Copy-Item -Path (Join-Path $buildDir "*") -Destination $publicDir -Recurse -Force

Write-Host "[4/4] Done: backend can now embed the latest frontend assets."
