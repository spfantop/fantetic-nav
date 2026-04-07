$ErrorActionPreference = "Stop"

# 明确切换到 UTF-8，确保脚本输出和后续命令都按统一编码执行。
chcp 65001 | Out-Null

# 统一从仓库根目录启动，避免相对路径依赖当前终端位置。
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "[准备] 先构建根目录 public，确保 Go embed 可编译。"
powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir "build-public.ps1")

Write-Host "[启动] 启动后端服务：http://localhost:6412"
Push-Location $repoRoot
try {
    go run .
}
finally {
    Pop-Location
}
