# PowerShell installer for Oh My Pi (OMP) on Windows.
# Requires PowerShell 5.1 or newer (PowerShell 7+ recommended).
#
# Usage:
#   .\install.ps1          # config.yml + core extensions
#   .\install.ps1 -All     # also legacy extensions, mcp.json, AGENTS.md

[CmdletBinding()]
param (
    [switch]$All,
    [switch]$CopyOnly,
    [string]$TargetAgentDir = (Join-Path $env:USERPROFILE ".omp\agent")
)

$ErrorActionPreference = "Stop"

Write-Host "==> Setting up Oh My Pi configuration on Windows..." -ForegroundColor Cyan
Write-Host "    Target Directory: $TargetAgentDir" -ForegroundColor DarkGray

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ExtensionsDir = Join-Path $TargetAgentDir "extensions"
$ConfigPath = Join-Path $TargetAgentDir "config.yml"

if (Test-Path $ConfigPath) {
    $configItem = Get-Item $ConfigPath -Force
    if ($configItem.LinkType) {
        Write-Host "==> $ConfigPath is a managed link; run the clone's sync.sh instead of this installer." -ForegroundColor Yellow
        exit 0
    }
}

if (-not (Test-Path $TargetAgentDir)) {
    New-Item -ItemType Directory -Force -Path $TargetAgentDir | Out-Null
}
if (-not (Test-Path $ExtensionsDir)) {
    New-Item -ItemType Directory -Force -Path $ExtensionsDir | Out-Null
}

function Install-ConfigFile {
    param (
        [string]$SourcePath,
        [string]$DestinationPath
    )

    $fileName = Split-Path -Leaf $SourcePath

    if (-not (Test-Path $SourcePath)) {
        Write-Warning "Source file not found: $SourcePath"
        return
    }

    if (Test-Path $DestinationPath) {
        $backupPath = "$DestinationPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
        Write-Host "  - Backing up existing $fileName -> $(Split-Path -Leaf $backupPath)" -ForegroundColor DarkYellow
        Copy-Item -Path $DestinationPath -Destination $backupPath -Force
        Remove-Item -Path $DestinationPath -Force
    }

    $linked = $false

    if (-not $CopyOnly) {
        try {
            New-Item -ItemType SymbolicLink -Path $DestinationPath -Target $SourcePath -Force -ErrorAction Stop | Out-Null
            Write-Host "  -> [Symlink] $fileName" -ForegroundColor Green
            $linked = $true
        } catch {
            Write-Host "  ! Symlink creation unavailable (requires Developer Mode or Admin)." -ForegroundColor DarkGray
            try {
                New-Item -ItemType HardLink -Path $DestinationPath -Target $SourcePath -Force -ErrorAction Stop | Out-Null
                Write-Host "  -> [Hardlink] $fileName" -ForegroundColor Green
                $linked = $true
            } catch {
                Write-Host "  ! Hardlink failed, falling back to copy." -ForegroundColor DarkGray
            }
        }
    }

    if (-not $linked) {
        Copy-Item -Path $SourcePath -Destination $DestinationPath -Force
        Write-Host "  -> [Copy] $fileName" -ForegroundColor Green
    }
}

$coreExtensions = @("omz-theme.ts", "jev-security.ts")
$legacyExtensions = @("tps.ts", "deepseek-hours.ts", "model-cost.ts")

Install-ConfigFile -SourcePath (Join-Path $ScriptDir "config.yml") -DestinationPath $ConfigPath
foreach ($name in $coreExtensions) {
    Install-ConfigFile -SourcePath (Join-Path $ScriptDir "extensions\$name") -DestinationPath (Join-Path $ExtensionsDir $name)
}

if ($All) {
    foreach ($name in $legacyExtensions) {
        Install-ConfigFile -SourcePath (Join-Path $ScriptDir "extensions\$name") -DestinationPath (Join-Path $ExtensionsDir $name)
    }
    Install-ConfigFile -SourcePath (Join-Path $ScriptDir "mcp.json") -DestinationPath (Join-Path $TargetAgentDir "mcp.json")
    Install-ConfigFile -SourcePath (Join-Path $ScriptDir "AGENTS.md") -DestinationPath (Join-Path $TargetAgentDir "AGENTS.md")
}

Write-Host "==> Done! Oh My Pi configuration installed." -ForegroundColor Cyan
Write-Host "    Core: config.yml, omz-theme.ts, jev-security.ts" -ForegroundColor DarkGray
if ($All) {
    Write-Host "    All:  tps.ts, deepseek-hours.ts, model-cost.ts, mcp.json, AGENTS.md" -ForegroundColor DarkGray
}
