using System.Net;
using System.Text.Json.Nodes;
using InkNeighbourConnect.Cloud;
using InkNeighbourConnect.Config;
using InkNeighbourConnect.Printers;

namespace InkNeighbourConnect.Tests;

public class CloudClientTests
{
    static readonly Uri Url = new("https://example.test/fn");

    [Fact] public async Task PairReturnsCredentialAndSendsNoAuthHeader()
    {
        var h = new StubHandler((_, _) => (HttpStatusCode.OK, """{"agent_id":"a1","credential":"a1.sec","heartbeat_interval_seconds":45}"""));
        var r = await new CloudClient(new HttpClient(h), Url).PairAsync("ABCDE12345", "PC", "0.1", default);
        Assert.Equal("a1.sec", r.Credential);
        Assert.Equal(45, r.HeartbeatIntervalSeconds);
        Assert.Null(h.Calls[0].Req.Headers.Authorization);
        Assert.Equal("pair", JsonNode.Parse(h.Calls[0].Body)!["action"]!.GetValue<string>());
    }

    [Fact] public async Task BadPairingCodeSurfacesTheCloudErrorCode()
    {
        var h = new StubHandler((_, _) => (HttpStatusCode.BadRequest, """{"error":"invalid_or_expired_code"}"""));
        var e = await Assert.ThrowsAsync<CloudException>(() => new CloudClient(new HttpClient(h), Url).PairAsync("x", "PC", "0.1", default));
        Assert.Equal("invalid_or_expired_code", e.Code);
    }

    [Fact] public async Task UnauthorizedWithCredentialMeansRemoved() =>
        await Assert.ThrowsAsync<CredentialRejectedException>(() =>
            new CloudClient(new HttpClient(new StubHandler((_, _) => (HttpStatusCode.Unauthorized, """{"error":"unauthorized"}"""))), Url)
                .HeartbeatAsync("a.b", "0.1", default));

    [Fact] public async Task SendsBearerCredential()
    {
        var h = new StubHandler((_, _) => (HttpStatusCode.OK, """{"ok":true}"""));
        await new CloudClient(new HttpClient(h), Url).HeartbeatAsync("a1.sec", "0.1", default);
        Assert.Equal("Bearer a1.sec", h.Calls[0].Req.Headers.Authorization!.ToString());
    }

    [Fact] public async Task RegisterSendsPrinterFields()
    {
        var h = new StubHandler((_, _) => (HttpStatusCode.OK, """{"printer_id":"p1","created":true}"""));
        var p = new PrinterInfo("HP|IP_1", "HP", null, "Drv", ConnectionType.Network, "10.0.0.5", "Drv", PrinterStatus.Ready, null);
        Assert.Equal("p1", await new CloudClient(new HttpClient(h), Url).RegisterPrinterAsync("c", p, default));
        var b = JsonNode.Parse(h.Calls[0].Body)!;
        Assert.Equal("network", b["connection_type"]!.GetValue<string>());
        Assert.Equal("10.0.0.5", b["ip_address"]!.GetValue<string>());
    }

    [Fact] public async Task TelemetryIsChunkedAtTheCloudLimitAndRejectsAreReturned()
    {
        var h = new StubHandler((_, body) =>
        {
            var n = JsonNode.Parse(body)!["readings"]!.AsArray().Count;
            var results = string.Join(",", Enumerable.Range(0, n).Select(i => i == 0 && n == 5
                ? """{"printer_id":"bad","accepted":false,"error":"unknown_printer"}"""
                : """{"printer_id":"ok","accepted":true}"""));
            return (HttpStatusCode.OK, $$"""{"ok":true,"results":[{{results}}]}""");
        });
        var readings = Enumerable.Range(0, 30).Select(i =>
            new ReadingDto($"p{i}", DateTimeOffset.UtcNow, "ready", null, null, [new ConsumableDto("toner", "black", null, "unsupported")])).ToList();
        var rejected = await new CloudClient(new HttpClient(h), Url).SendTelemetryAsync("c", readings, default);
        Assert.Equal(2, h.Calls.Count);
        Assert.Equal("unknown_printer", Assert.Single(rejected).Error);
        var first = JsonNode.Parse(h.Calls[0].Body)!["readings"]![0]!;
        Assert.Null(first["consumables"]![0]!["level"]);
        Assert.Matches(@"^\d{4}-\d\d-\d\dT.*Z$", first["observed_at"]!.GetValue<string>());
    }
}

public class CredentialStoreTests
{
    [Fact] public void RoundTripAndClear()
    {
        var path = Path.Combine(Path.GetTempPath(), $"ink-{Guid.NewGuid()}", "agent.json");
        var store = new FileCredentialStore(path);
        Assert.Null(store.Load());
        store.Save(new AgentState("a.b", new Uri("https://x.test/fn")));
        var s = store.Load()!;
        Assert.Equal("a.b", s.Credential);
        Assert.Equal(new Uri("https://x.test/fn"), s.Endpoint);
        if (!OperatingSystem.IsWindows())
            Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, File.GetUnixFileMode(path));
        store.Clear();
        Assert.Null(store.Load());
    }
}
