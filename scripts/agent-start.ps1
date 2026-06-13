$ErrorActionPreference = "Continue"

$RepoPath = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoPath

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "== $Title =="
}

function Run-Info {
  param(
    [string]$Label,
    [scriptblock]$Command
  )

  Write-Host "${Label}:"
  try {
    & $Command
  } catch {
    Write-Host "Unavailable: $($_.Exception.Message)"
  }
}

Write-Section "Repository"
Write-Host "Repo path: $RepoPath"
Run-Info "Current branch" { git branch --show-current }
Run-Info "Git status" { git status --short --branch }

Write-Section "Recent commits"
Run-Info "git log --oneline --max-count=8" { git log --oneline --max-count=8 }

Write-Section "Runtime"
Run-Info "Node version" { node --version }
Run-Info "pnpm version" { pnpm --version }

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Run-Info "Docker version" { docker --version }
  Run-Info "Docker Compose services" { docker compose ps }
} else {
  Write-Host "Docker version: unavailable"
}

Write-Section "Important docs to read"
Write-Host "AGENTS.md"
Write-Host "docs/ai/START_HERE.md"
Write-Host "docs/ai/CURRENT_STATE.md"
Write-Host "docs/ai/WORKFLOW.md"
Write-Host "docs/handoff.md"
Write-Host "docs/decisions/"

Write-Section "Standard verification commands"
Write-Host "pnpm prisma:generate"
Write-Host "pnpm typecheck"
Write-Host "pnpm lint"
Write-Host "pnpm build:web"
Write-Host "pnpm build:api"
Write-Host "docker compose config"
Write-Host "pnpm check:all"
Write-Host "pnpm doctor"

Write-Section "Phase reminder"
Write-Host "Only ACCOUNTANT is confirmed in Phase 1A."
Write-Host "Do not add unconfirmed office roles or accounting business modules."
