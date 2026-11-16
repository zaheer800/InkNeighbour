# InkNeighbour Connect (Windows agent)

A .NET 10 Worker Service that runs on the print shop's Windows PC and reports printer status and
supply levels to InkNeighbour (the `printer-agent` edge function).

## Scope (P2)

- In: discover installed printers (WMI), read status, read ink/toner levels and page count over SNMP v2c
  (Printer MIB, RFC 3805) for network printers, send heartbeats and telemetry.
- Out: printing, print jobs, changing any printer setting. SNMP is GET-NEXT only; the agent never sends SET.
- USB printers report status only (no supply levels without vendor drivers). Levels the printer does not
  report are sent as `unsupported`, never as 0%.

## Build and test

    dotnet test agent/InkNeighbourConnect.slnx
    dotnet publish agent/src/InkNeighbourConnect -c Release -r win-x64 --self-contained \
      -p:PublishSingleFile=true -o agent/publish/win-x64

WMI discovery and DPAPI credential protection are Windows-only and are covered by compile checks, not
by the Linux test run. On Windows they need a manual pilot check.

## Install (pilot, unsigned)

1. On the My Printers page choose Add computer to get a pairing code (valid 15 minutes).
2. Copy `InkNeighbourConnect.exe` and `install/install.ps1` to the PC.
3. Elevated PowerShell: `.\install.ps1 -Code ABCDE-12345`. Windows SmartScreen will warn because the
   build is unsigned; that is expected for the pilot.

Uninstall with `install/uninstall.ps1`, then Disconnect the computer on the My Printers page.

## Running on any OS (testing)

    INKCONNECT_STATE=/tmp/ink.json dotnet run --project agent/src/InkNeighbourConnect -- pair <code>
    INKCONNECT_STATE=/tmp/ink.json dotnet run --project agent/src/InkNeighbourConnect

Non-Windows hosts have no printer source, so only the heartbeat runs.

## Security

- The credential is stored with DPAPI (LocalMachine) at `%ProgramData%\InkNeighbourConnect\agent.json`.
- Pairing requires HTTPS except for loopback. A rejected credential (401) makes the agent clear it and stop.
- The SNMP community is the default `public`; pilot printers must allow read access with it.

## Known limitations

- Status comes from the legacy WMI `PrinterStatus`/`DetectedErrorState` fields. A printer that is powered
  off but still has a spooler queue may show as ready; SNMP-reachable printers that stop answering are
  caught by the cloud staleness rule, but USB printers are not.
- Supply levels are read only for network printers (SNMP v2c, community `public`).
- DPAPI uses machine scope; the state directory is restricted to SYSTEM and Administrators.
