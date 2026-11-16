<#
  InkNeighbour Connect installer (pilot, unsigned).
  Run in an elevated PowerShell from the folder that contains InkNeighbourConnect.exe:
    .\install.ps1 -Code ABCDE-12345
  Pairs this PC with your InkNeighbour account, then installs a Windows service that reports printer
  status and supply levels. Read-only: it never prints, never changes printer settings.
#>
param(
  [Parameter(Mandatory = $true)][string]$Code,
  [string]$InstallDir = "$env:ProgramFiles\InkNeighbourConnect"
)
$ErrorActionPreference = 'Stop'

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script as Administrator (right-click PowerShell, Run as administrator).'
}

$src = Join-Path $PSScriptRoot 'InkNeighbourConnect.exe'
if (-not (Test-Path $src)) { throw "InkNeighbourConnect.exe not found next to install.ps1 ($PSScriptRoot)." }

$svc = Get-Service -Name 'InkNeighbourConnect' -ErrorAction SilentlyContinue
if ($svc) {
  if ($svc.Status -ne 'Stopped') { Stop-Service $svc.Name -Force; $svc.WaitForStatus('Stopped', '00:00:30') }
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item $src (Join-Path $InstallDir 'InkNeighbourConnect.exe') -Force
$exe = Join-Path $InstallDir 'InkNeighbourConnect.exe'

& $exe pair $Code
if ($LASTEXITCODE -ne 0) { throw 'Pairing failed. Generate a new code on the My Printers page and try again.' }

if (-not $svc) {
  New-Service -Name 'InkNeighbourConnect' -BinaryPathName "`"$exe`"" -DisplayName 'InkNeighbour Connect' `
    -Description 'Reports printer status and supply levels to InkNeighbour (read-only).' -StartupType Automatic | Out-Null
  sc.exe failure InkNeighbourConnect reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
}
Start-Service 'InkNeighbourConnect'
Write-Host 'InkNeighbour Connect is installed and running. Check the My Printers page in a minute.'
