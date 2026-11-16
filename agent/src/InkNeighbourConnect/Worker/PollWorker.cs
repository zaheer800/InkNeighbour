using InkNeighbourConnect.Cloud;
using InkNeighbourConnect.Config;
using InkNeighbourConnect.Printers;
using InkNeighbourConnect.Snmp;

namespace InkNeighbourConnect.Worker;

public sealed class PollWorker(
    ICredentialStore store, ICloudClient cloud, IPrinterSource printers, ISnmpWalker snmp,
    IHostApplicationLifetime lifetime, ILogger<PollWorker> log, TimeProvider? clock = null) : BackgroundService
{
    public const string Version = "0.1.0";
    private const string SnmpCommunity = "public";
    private readonly TimeProvider _clock = clock ?? TimeProvider.System;
    private readonly Dictionary<string, string> _printerIds = new();

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        var state = store.Load();
        if (state is null)
        {
            log.LogError("This computer is not paired. Run: InkNeighbourConnect pair <code>");
            lifetime.StopApplication();
            return;
        }

        var interval = TimeSpan.FromSeconds(60);
        var failures = 0;
        var rejections = 0;
        while (!stop.IsCancellationRequested)
        {
            try
            {
                interval = TimeSpan.FromSeconds(Math.Max(15, await cloud.HeartbeatAsync(state.Credential, Version, stop)));
                await CycleAsync(state.Credential, stop);
                failures = 0;
                rejections = 0;
            }
            catch (CredentialRejectedException) when (++rejections < 3)
            {
                failures++;
                log.LogWarning("Credential was not accepted ({Count} of 3). Retrying.", rejections);
            }
            catch (CredentialRejectedException)
            {
                log.LogError("This computer was removed in InkNeighbour. Stopping. Pair again to reconnect.");
                store.Clear();
                lifetime.StopApplication();
                return;
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { return; }
            catch (Exception e)
            {
                failures++;
                log.LogWarning("Update failed ({Failures} in a row): {Message}", failures, e.Message);
            }

            // Back off while the cloud or network is unavailable, capped at 10 minutes.
            var delay = failures == 0 ? interval : TimeSpan.FromSeconds(Math.Min(600, interval.TotalSeconds * Math.Pow(2, Math.Min(failures, 4))));
            try { await Task.Delay(delay, _clock, stop); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task<ReadingDto> BuildSafeAsync(string id, PrinterInfo p, DateTimeOffset now, CancellationToken ct)
    {
        try { return await ReadingBuilder.BuildAsync(id, p, snmp, SnmpCommunity, now, ct); }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning("Could not read supplies for {Printer}: {Message}", p.Name, e.Message);
            return await ReadingBuilder.BuildAsync(id, p with { Connection = ConnectionType.Other }, snmp, SnmpCommunity, now, ct);
        }
    }

    public async Task CycleAsync(string credential, CancellationToken ct)
    {
        var now = _clock.GetUtcNow();
        var readings = new List<ReadingDto>();
        IReadOnlyList<PrinterInfo> found;
        try { found = printers.GetPrinters(); }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogWarning("Could not list printers: {Message}", e.Message);
            return;
        }
        var work = new List<(string Id, PrinterInfo Printer)>();
        foreach (var p in found)
        {
            if (!_printerIds.TryGetValue(p.DeviceIdentifier, out var id))
            {
                try { id = await cloud.RegisterPrinterAsync(credential, p, ct); }
                catch (CloudException e) { log.LogWarning("Could not register {Printer}: {Error}", p.Name, e.Code); continue; }
                _printerIds[p.DeviceIdentifier] = id;
            }
            work.Add((id, p));
        }
        // Printers are read in parallel so one unreachable device cannot delay the rest or the next heartbeat.
        readings.AddRange(await Task.WhenAll(work.Select(w => BuildSafeAsync(w.Id, w.Printer, now, ct))));
        if (readings.Count == 0) return;
        foreach (var r in await cloud.SendTelemetryAsync(credential, readings, ct))
        {
            log.LogWarning("Cloud rejected a reading for {Printer}: {Error}", r.PrinterId, r.Error);
            // A printer removed in the app comes back as unknown: forget it so the next cycle registers it again.
            if (r.Error == "unknown_printer")
                foreach (var k in _printerIds.Where(kv => kv.Value == r.PrinterId).Select(kv => kv.Key).ToList())
                    _printerIds.Remove(k);
        }
    }
}
