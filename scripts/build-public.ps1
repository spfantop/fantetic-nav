$ErrorActionPreference = "Stop"

# 明确切换到 UTF-8，避免 PowerShell 在输出和复制过程中引入乱码问题。
chcp 65001 | Out-Null

# 始终以脚本所在位置为基准解析仓库根目录，避免从不同终端目录执行时路径失效。
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$uiDir = Join-Path $repoRoot "ui"
$buildDir = Join-Path $uiDir "build"
$publicDir = Join-Path $repoRoot "public"

Write-Host "[1/4] 安装前端依赖..."
Push-Location $uiDir
try {
    pnpm install

    # 前端产物是后端 embed 的唯一来源，所以每次都重新构建，避免根目录 public 过期。
    Write-Host "[2/4] 构建前端静态资源..."
    pnpm build
}
finally {
    Pop-Location
}

if (-not (Test-Path $buildDir)) {
    throw "前端构建失败：未生成 $buildDir"
}

# 先清空旧的 public，再完整复制 build，保证 embed 目录内容与当前前端产物一致。
Write-Host "[3/4] 同步静态资源到根目录 public..."
if (Test-Path $publicDir) {
    Remove-Item -LiteralPath $publicDir -Recurse -Force
}
New-Item -ItemType Directory -Path $publicDir | Out-Null
Copy-Item -Path (Join-Path $buildDir "*") -Destination $publicDir -Recurse -Force

Write-Host "[4/4] 完成：后端现在可以直接编译并内嵌前端资源。"
