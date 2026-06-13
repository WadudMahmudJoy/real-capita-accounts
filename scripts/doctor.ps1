$ErrorActionPreference = "Continue"

$RepoPath = Resolve-Path (Join-Path $PSScriptRoot "..")
$ExpectedPath = "D:\real-capita-accounts"
$Warnings = New-Object System.Collections.Generic.List[string]

Set-Location $RepoPath

function Add-Warning {
  param([string]$Message)
  $Warnings.Add($Message) | Out-Null
}

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "== $Title =="
}

Write-Section "Project path"
Write-Host "Current path: $RepoPath"
if ($RepoPath.Path -ne $ExpectedPath) {
  Add-Warning "Expected project path is $ExpectedPath."
}

Write-Section "Git"
if (Test-Path (Join-Path $RepoPath ".git")) {
  Write-Host "Git repo: found"
  git status --short --branch
} else {
  Add-Warning "No .git directory found. Confirm you are in the repository root."
}

Write-Section "Environment"
$EnvPath = Join-Path $RepoPath ".env"
if (Test-Path $EnvPath) {
  Write-Host ".env: found"
  $DatabaseUrlLine = Select-String -Path $EnvPath -Pattern "^DATABASE_URL=" -ErrorAction SilentlyContinue

  if ($DatabaseUrlLine -and $DatabaseUrlLine.Line.Contains("55432")) {
    Write-Host "DATABASE_URL: uses host port 55432"
  } else {
    Add-Warning "DATABASE_URL should use localhost:55432 for this project."
  }
} else {
  Add-Warning ".env is missing. Copy .env.example to .env for local development."
}

Write-Section "Docker"
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker --version
  try {
    docker compose ps postgres
  } catch {
    Add-Warning "Could not read docker compose postgres status. Start Docker Desktop and run docker compose up -d postgres."
  }
} else {
  Add-Warning "Docker is not available on PATH."
}

Write-Section "Local ports"
foreach ($Port in @(4000, 3000, 3010, 55432)) {
  $Listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

  if ($Listeners) {
    $ProcessIds = ($Listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
    Write-Host "Port ${Port}: occupied by process id(s) $ProcessIds"

    if ($Port -eq 4000) {
      Add-Warning "Port 4000 is occupied. Stop the existing API process or start this API on a different API_PORT."
    }

    if ($Port -eq 3000) {
      Add-Warning "Port 3000 is occupied. Use port 3010 for the web app and set WEB_ORIGIN=http://localhost:3010 when starting the API."
    }

    if ($Port -eq 3010) {
      Add-Warning "Port 3010 is occupied. Stop the existing web process or choose another temporary web port and match WEB_ORIGIN."
    }
  } else {
    Write-Host "Port ${Port}: free"

    if ($Port -eq 55432) {
      Add-Warning "Port 55432 is free. Start PostgreSQL with docker compose up -d postgres before database work."
    }
  }
}

Write-Section "Role boundary scan"
$ForbiddenPatterns = @(
  "AGM_ADMIN",
  "ACCOUNTANT_CHECKER",
  "DATA_ENTRY",
  "MD_VIEWER",
  "SUPER_ADMIN",
  "Super Admin",
  "Data Entry",
  "MD Viewer",
  "Checker",
  "Payroll",
  "HR",
  "Sales"
)
$SourceFiles = @()

foreach ($Target in @("prisma\schema.prisma", "prisma\seed.ts", "apps", "packages")) {
  $Path = Join-Path $RepoPath $Target

  if (Test-Path $Path -PathType Leaf) {
    $SourceFiles += Get-Item $Path
  }

  if (Test-Path $Path -PathType Container) {
    $SourceFiles += Get-ChildItem -Path $Path -Recurse -File |
      Where-Object {
        $_.Extension -in @(".ts", ".tsx", ".prisma", ".js", ".mjs") -and
        $_.FullName -notmatch "\\(node_modules|dist|build|\.next|generated)\\"
      }
  }
}

$RoleHits = @()
foreach ($Pattern in $ForbiddenPatterns) {
  $RoleHits += $SourceFiles | Select-String -Pattern $Pattern -SimpleMatch -CaseSensitive -ErrorAction SilentlyContinue
}

if ($RoleHits.Count -gt 0) {
  Add-Warning "Unconfirmed role names were found in Prisma/source files. Review and remove them before continuing."
  $RoleHits | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
} else {
  Write-Host "No unconfirmed role names found in Prisma/source files."
}

Write-Section "Result"
if ($Warnings.Count -eq 0) {
  Write-Host "Doctor completed without warnings."
} else {
  Write-Host "Doctor completed with warnings:"
  foreach ($Warning in $Warnings) {
    Write-Host "- $Warning"
  }
}
