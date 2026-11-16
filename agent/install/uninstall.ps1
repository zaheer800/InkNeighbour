# Removes the InkNeighbour Connect service, files and stored credential. Run as Administrator.
$ErrorActionPreference = 'Stop'
$svc = Get-Service -Name 'InkNeighbourConnect' -ErrorAction SilentlyContinue
if ($svc) {
  if ($svc.Status -ne 'Stopped') { Stop-Service $svc.Name -Force }
  sc.exe delete InkNeighbourConnect | Out-Null
}
Remove-Item "$env:ProgramFiles\InkNeighbourConnect" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:ProgramData\InkNeighbourConnect" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Removed. Also use Disconnect on the My Printers page to revoke this PC in the cloud.'
