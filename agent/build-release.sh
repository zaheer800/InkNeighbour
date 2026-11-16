#!/usr/bin/env bash
# Builds agent/publish/InkNeighbourConnect-win-x64.zip (exe + install scripts), the file served by agent-download.
set -euo pipefail
cd "$(dirname "$0")"
dotnet test InkNeighbourConnect.slnx
rm -rf publish/win-x64 publish/zip
dotnet publish src/InkNeighbourConnect -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish/win-x64
mkdir -p publish/zip
cp publish/win-x64/InkNeighbourConnect.exe install/install.ps1 install/uninstall.ps1 publish/zip/
(cd publish/zip && zip -q -9 ../InkNeighbourConnect-win-x64.zip *)
ls -l publish/InkNeighbourConnect-win-x64.zip
