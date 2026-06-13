$ErrorActionPreference = "Stop"

$RepoPath = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoPath

function Invoke-Check {
  param(
    [string]$Label,
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Host ""
  Write-Host "== $Label =="
  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

Invoke-Check "Prisma generate" "pnpm" @("prisma:generate")
Invoke-Check "Typecheck" "pnpm" @("typecheck")
Invoke-Check "Lint" "pnpm" @("lint")
Invoke-Check "Build web" "pnpm" @("build:web")
Invoke-Check "Build api" "pnpm" @("build:api")
Invoke-Check "Docker Compose config" "docker" @("compose", "config")

Write-Host ""
Write-Host "All checks passed."
