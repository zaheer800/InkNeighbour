using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using InkNeighbourConnect.Printers;

namespace InkNeighbourConnect.Cloud;

public sealed class CloudException(HttpStatusCode status, string code) : Exception($"{(int)status} {code}")
{
    public HttpStatusCode Status { get; } = status;
    public string Code { get; } = code;
}

// Raised when the cloud no longer accepts this agent (removed in the app). The agent must stop, not retry.
public sealed class CredentialRejectedException() : Exception("The cloud rejected this computer's credential.");

public sealed record PairResult(string AgentId, string Credential, int HeartbeatIntervalSeconds);
public sealed record Rejected(string PrinterId, string Error);

public interface ICloudClient
{
    Task<PairResult> PairAsync(string code, string deviceName, string version, CancellationToken ct);
    Task<int> HeartbeatAsync(string credential, string version, CancellationToken ct);
    Task<string> RegisterPrinterAsync(string credential, PrinterInfo printer, CancellationToken ct);
    Task<IReadOnlyList<Rejected>> SendTelemetryAsync(string credential, IReadOnlyList<ReadingDto> readings, CancellationToken ct);
}

public sealed record ConsumableDto(string Type, string Colour, int? Level, string Source);

public sealed record ReadingDto(
    string PrinterId, DateTimeOffset ObservedAt, string Status, string? StatusDetail, int? PageCount,
    IReadOnlyList<ConsumableDto> Consumables,
    int? QueuedJobs = null);

public sealed class CloudClient(HttpClient http, Uri endpoint) : ICloudClient
{
    public const int MaxReadingsPerCall = 25;

    public async Task<PairResult> PairAsync(string code, string deviceName, string version, CancellationToken ct)
    {
        var r = await PostAsync(null, new JsonObject
        {
            ["action"] = "pair", ["code"] = code, ["device_name"] = deviceName, ["agent_version"] = version,
        }, ct);
        return new PairResult(
            r["agent_id"]!.GetValue<string>(), r["credential"]!.GetValue<string>(),
            r["heartbeat_interval_seconds"]?.GetValue<int>() ?? 60);
    }

    public async Task<int> HeartbeatAsync(string credential, string version, CancellationToken ct)
    {
        var r = await PostAsync(credential, new JsonObject { ["action"] = "heartbeat", ["agent_version"] = version }, ct);
        return r["heartbeat_interval_seconds"]?.GetValue<int>() ?? 60;
    }

    public async Task<string> RegisterPrinterAsync(string credential, PrinterInfo p, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["action"] = "register-printer",
            ["device_identifier"] = p.DeviceIdentifier,
            ["name"] = p.Name,
            ["manufacturer"] = p.Manufacturer,
            ["model"] = p.Model,
            ["connection_type"] = p.Connection.ToString().ToLowerInvariant(),
            ["ip_address"] = p.IpAddress,
            ["driver_info"] = p.DriverInfo,
        };
        var r = await PostAsync(credential, body, ct);
        return r["printer_id"]!.GetValue<string>();
    }

    public async Task<IReadOnlyList<Rejected>> SendTelemetryAsync(
        string credential, IReadOnlyList<ReadingDto> readings, CancellationToken ct)
    {
        var rejected = new List<Rejected>();
        foreach (var chunk in readings.Chunk(MaxReadingsPerCall))
        {
            var arr = new JsonArray();
            foreach (var r in chunk)
            {
                var consumables = new JsonArray();
                foreach (var c in r.Consumables)
                    consumables.Add(new JsonObject { ["type"] = c.Type, ["colour"] = c.Colour, ["level"] = c.Level, ["source"] = c.Source });
                arr.Add(new JsonObject
                {
                    ["printer_id"] = r.PrinterId,
                    ["observed_at"] = r.ObservedAt.UtcDateTime.ToString("o"),
                    ["status"] = r.Status,
                    ["status_detail"] = r.StatusDetail,
                    ["page_count"] = r.PageCount,
                    ["queued_jobs"] = r.QueuedJobs,
                    ["consumables"] = consumables,
                });
            }
            var res = await PostAsync(credential, new JsonObject { ["action"] = "telemetry", ["readings"] = arr }, ct);
            foreach (var item in res["results"]?.AsArray() ?? [])
                if (item?["accepted"]?.GetValue<bool>() == false)
                    rejected.Add(new Rejected(item["printer_id"]?.GetValue<string>() ?? "", item["error"]?.GetValue<string>() ?? "unknown"));
        }
        return rejected;
    }

    private async Task<JsonNode> PostAsync(string? credential, JsonObject body, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = JsonContent.Create(body) };
        if (credential is not null) req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {credential}");
        using var res = await http.SendAsync(req, ct);
        JsonNode? json = null;
        try { json = JsonNode.Parse(await res.Content.ReadAsStringAsync(ct)); } catch (JsonException) { }
        if (res.IsSuccessStatusCode) return json ?? new JsonObject();
        if (res.StatusCode == HttpStatusCode.Unauthorized && credential is not null) throw new CredentialRejectedException();
        throw new CloudException(res.StatusCode, json?["error"]?.GetValue<string>() ?? "unknown");
    }
}
