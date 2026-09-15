# Deploy ATLASX3 to a Hostinger VPS over SSH.
# Usage:
#   .\scripts\deploy-hostinger.ps1                       # uses env/defaults
#   .\scripts\deploy-hostinger.ps1 -DeployHost 1.2.3.4 -User root
#   .\scripts\deploy-hostinger.ps1 -ListVps              # discover VPS via Hostinger API
param(
  [string]$DeployHost = $env:HOSTINGER_DEPLOY_HOST,
  [string]$User = $(if ($env:HOSTINGER_DEPLOY_USER) { $env:HOSTINGER_DEPLOY_USER } else { "root" }),
  [string]$AppDir = "/var/www/atlasx3",
  [string]$AppName = "atlasx3",
  [switch]$ListVps,
  [switch]$FullSetup   # run deploy.sh on the server (first-time setup: dirs, nginx, pm2)
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

# Load .env for HOSTINGER_* values without exporting secrets to the console
$dotenv = Join-Path $repoRoot ".env"
$envMap = @{}
if (Test-Path $dotenv) {
  Get-Content $dotenv | Where-Object { $_ -match "^\s*[^#].*=" } | ForEach-Object {
    $k, $v = $_ -split "=", 2
    $envMap[$k.Trim()] = $v.Trim()
  }
}if (-not $DeployHost -and $envMap.ContainsKey("HOSTINGER_DEPLOY_HOST")) { $DeployHost = $envMap["HOSTINGER_DEPLOY_HOST"] }

if ($ListVps) {
  $apiKey = if ($env:HOSTINGER_API_KEY) { $env:HOSTINGER_API_KEY } elseif ($envMap.ContainsKey("HOSTINGER_API_KEY")) { $envMap["HOSTINGER_API_KEY"] } else { $null }
  if (-not $apiKey) { Write-Error "HOSTINGER_API_KEY not set (env or .env)"; exit 1 }
  Write-Host "Fetching VPS list from Hostinger API..." -ForegroundColor Cyan
  $vms = Invoke-RestMethod -Uri "https://developers.hostinger.com/api/vps/v1/virtual-machines" -Headers @{ Authorization = "Bearer $apiKey" }
  $vms | ForEach-Object {
    [PSCustomObject]@{
      Id       = $_.id
      Hostname = $_.hostname
      State    = $_.state
      IPv4     = ($_.ipv4 | ForEach-Object { $_.address }) -join ", "
      Plan     = $_.plan
    }
  } | Format-Table -AutoSize
  exit 0
}

if (-not $DeployHost) {
  Write-Error "No deploy host. Pass -DeployHost <ip-or-domain>, set HOSTINGER_DEPLOY_HOST, or run -ListVps to discover your VPS IP."
  exit 1
}

Write-Host "Deploying $AppName to $User@${DeployHost}:$AppDir" -ForegroundColor Green

# 1. Package tracked files only (respects .gitignore - no .env, node_modules, data)
$artifact = Join-Path ([System.IO.Path]::GetTempPath()) "atlasx3-deploy.tar.gz"
Write-Host "Packaging (git archive)..." -ForegroundColor Cyan
Push-Location $repoRoot
try {
  git archive --format=tar.gz -o $artifact HEAD
  if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
} finally {
  Pop-Location
}

# 2. Upload
Write-Host "Uploading artifact..." -ForegroundColor Cyan
ssh "$User@$DeployHost" "mkdir -p $AppDir"
if ($LASTEXITCODE -ne 0) { Write-Error "SSH connection failed - check host/user and that your SSH key is authorized on the VPS"; exit 1 }
scp $artifact "${User}@${DeployHost}:/tmp/atlasx3-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { Write-Error "scp upload failed"; exit 1 }

# 3. Extract, install, restart
Write-Host "Installing on server..." -ForegroundColor Cyan
$remote = @(
  "set -e",
  "tar -xzf /tmp/atlasx3-deploy.tar.gz -C $AppDir",
  "rm /tmp/atlasx3-deploy.tar.gz",
  "cd $AppDir",
  "npm ci --omit=dev",
  "mkdir -p logs data/backups"
)
if ($FullSetup) {
  $remote += "bash deploy.sh"
} else {
  $remote += "pm2 startOrReload ecosystem.config.js --env production"
  $remote += "pm2 save"
}
ssh "$User@$DeployHost" ($remote -join " && ")
if ($LASTEXITCODE -ne 0) { Write-Error "Remote install/restart failed - see output above"; exit 1 }

Remove-Item $artifact -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Deployed. Verify:" -ForegroundColor Green
Write-Host "   ssh $User@$DeployHost 'pm2 status && curl -s http://127.0.0.1:4000/api/health || true'"
Write-Host "   Reminder: the server needs its own $AppDir/.env (never shipped by this script)."
