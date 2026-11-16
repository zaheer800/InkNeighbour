#!/usr/bin/env bash
# Builds agent/publish/InkNeighbourConnect-win-x64.zip (the single installer/agent exe), the file served by agent-download.
set -euo pipefail
cd "$(dirname "$0")"
dotnet test InkNeighbourConnect.slnx
rm -rf publish/win-x64 publish/zip publish/InkNeighbourConnect-win-x64.zip
dotnet publish src/InkNeighbourConnect -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o publish/win-x64
mkdir -p publish/zip
cp publish/win-x64/InkNeighbourConnect.exe publish/zip/
(cd publish/zip && zip -q -9 ../InkNeighbourConnect-win-x64.zip *)
ls -l publish/InkNeighbourConnect-win-x64.zip
