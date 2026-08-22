# PowerShell Installation Script for Oh My Pi (OMP) on Windows
# Requires PowerShell 5.1 or newer (PowerShell 7+ recommended)

[CmdletBinding()]
param (
    [switch]$CopyOnly,
    [string]$TargetAgentDir = (Join-Path $env:USERPROFILE ".omp\agent")
)

$ErrorActionPreference = "Stop"

Write-Host "==> Setting up Oh My Pi configuration on Windows..." -ForegroundColor Cyan
Write-Host "    Target Directory: $TargetAgentDir" -ForegroundColor DarkGray

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ExtensionsDir = Join-Path $TargetAgentDir "extensions"

# Ensure target directories exist
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

    # Backup existing file if present
    if (Test-Path $DestinationPath) {
        $backupPath = "$DestinationPath.bak"
        Write-Host "  - Backing up existing $fileName -> $(Split-Path -Leaf $backupPath)" -ForegroundColor DarkYellow
        Copy-Item -Path $DestinationPath -Destination $backupPath -Force
        Remove-Item -Path $DestinationPath -Force
    }

    $linked = $false

    if (-not $CopyOnly) {
        try {
            New-Item -ItemType SymbolicLink -Path $DestinationPath -Target $SourcePath -Force -ErrorAction Stop | Out-Null
            Write-Host "  -> [Symlink] $fileName linked to $(Split-Path -Leaf $DestinationPath)" -ForegroundColor Green
            $linked = $true
        } catch {
            Write-Host "  ! Symlink creation unavailable (requires Developer Mode or Admin)." -ForegroundColor DarkGray
            try {
                New-Item -ItemType HardLink -Path $DestinationPath -Target $SourcePath -Force -ErrorAction Stop | Out-Null
                Write-Host "  -> [Hardlink] $fileName linked to $(Split-Path -Leaf $DestinationPath)" -ForegroundColor Green
                $linked = $true
            } catch {
                Write-Host "  ! Hardlink failed, falling back to copy." -ForegroundColor DarkGray
            }
        }
    }

    if (-not $linked) {
        Copy-Item -Path $SourcePath -Destination $DestinationPath -Force
        Write-Host "  -> [Copy] $fileName copied to $(Split-Path -Leaf $DestinationPath)" -ForegroundColor Green
    }
}

# Install configuration files
Install-ConfigFile -SourcePath (Join-Path $ScriptDir "config.yml") -DestinationPath (Join-Path $TargetAgentDir "config.yml")
Install-ConfigFile -SourcePath (Join-Path $ScriptDir "mcp.json") -DestinationPath (Join-Path $TargetAgentDir "mcp.json")
Install-ConfigFile -SourcePath (Join-Path $ScriptDir "AGENTS.md") -DestinationPath (Join-Path $TargetAgentDir "AGENTS.md")
Install-ConfigFile -SourcePath (Join-Path $ScriptDir "extensions\tps.ts") -DestinationPath (Join-Path $ExtensionsDir "tps.ts")
Install-ConfigFile -SourcePath (Join-Path $ScriptDir "extensions\deepseek-hours.ts") -DestinationPath (Join-Path $ExtensionsDir "deepseek-hours.ts")
Install-ConfigFile -SourcePath (Join-Path $ScriptDir "extensions\model-cost.ts") -DestinationPath (Join-Path $ExtensionsDir "model-cost.ts")

Write-Host "==> Done! Oh My Pi configuration successfully configured on Windows." -ForegroundColor Cyan
