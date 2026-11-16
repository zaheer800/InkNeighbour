using System.Net;
using InkNeighbourConnect.Cloud;
using InkNeighbourConnect.Printers;
using InkNeighbourConnect.Snmp;

namespace InkNeighbourConnect.Tests;

sealed class FakeWalker(Dictionary<string, Dictionary<string, string>> data) : ISnmpWalker
{
    public List<string> Hosts { get; } = [];
    public Task<IReadOnlyDictionary<string, string>> WalkAsync(string host, string community, string rootOid, CancellationToken ct)
    {
        Hosts.Add(host);
        IReadOnlyDictionary<string, string> r = data.GetValueOrDefault(rootOid) ?? new Dictionary<string, string>();
        return Task.FromResult(r);
    }
}

sealed class FakePrinters(params PrinterInfo[] list) : IPrinterSource
{
    public IReadOnlyList<PrinterInfo> GetPrinters() => list;
}

sealed class FakeCloud : ICloudClient
{
    public int Registers;
    public List<IReadOnlyList<ReadingDto>> Sent = [];
    public List<Rejected> NextRejects = [];
    public Task<PairResult> PairAsync(string code, string deviceName, string version, CancellationToken ct) => throw new NotImplementedException();
    public Task<int> HeartbeatAsync(string credential, string version, CancellationToken ct) => Task.FromResult(60);
    public Task<string> RegisterPrinterAsync(string credential, PrinterInfo printer, CancellationToken ct) => Task.FromResult($"id-{++Registers}");
    public Task<IReadOnlyList<Rejected>> SendTelemetryAsync(string credential, IReadOnlyList<ReadingDto> readings, CancellationToken ct)
    {
        Sent.Add(readings);
        var r = NextRejects; NextRejects = [];
        return Task.FromResult<IReadOnlyList<Rejected>>(r);
    }
}

sealed class StubHandler(Func<HttpRequestMessage, string, (HttpStatusCode, string)> respond) : HttpMessageHandler
{
    public List<(HttpRequestMessage Req, string Body)> Calls { get; } = [];
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(ct);
        Calls.Add((request, body));
        var (code, json) = respond(request, body);
        return new HttpResponseMessage(code) { Content = new StringContent(json) };
    }
}
