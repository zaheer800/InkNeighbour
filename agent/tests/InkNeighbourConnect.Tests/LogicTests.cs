using InkNeighbourConnect.Printers;
using InkNeighbourConnect.Snmp;
using InkNeighbourConnect.Worker;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace InkNeighbourConnect.Tests;

public class StatusMapperTests
{
    [Theory]
    [InlineData(3, 2, false, PrinterStatus.Ready, null)]
    [InlineData(4, 2, false, PrinterStatus.Busy, null)]
    [InlineData(5, 0, false, PrinterStatus.Busy, null)]
    [InlineData(7, 2, false, PrinterStatus.Offline, null)]
    [InlineData(3, 9, false, PrinterStatus.Offline, null)]
    [InlineData(3, 2, true, PrinterStatus.Offline, null)]
    [InlineData(3, 8, false, PrinterStatus.Error, "Paper jam")]
    [InlineData(3, 4, false, PrinterStatus.Error, "Out of paper")]
    [InlineData(6, 2, false, PrinterStatus.Error, "Printing stopped")]
    [InlineData(2, 0, false, PrinterStatus.Unknown, null)]
    public void Maps(int ps, int err, bool off, PrinterStatus status, string? detail)
    {
        var (s, d) = StatusMapper.Map(ps, err, off);
        Assert.Equal(status, s);
        Assert.Equal(detail, d);
    }

    [Fact] public void WireNamesMatchCloudVocabulary() =>
        Assert.Equal(["ready", "busy", "error", "offline", "unknown"],
            new[] { PrinterStatus.Ready, PrinterStatus.Busy, PrinterStatus.Error, PrinterStatus.Offline, PrinterStatus.Unknown }.Select(StatusMapper.ToWire));
}

public class SupplyParserTests
{
    static Dictionary<string, IReadOnlyDictionary<string, string>> Cols(params (string row, int? cls, int type, string desc, int max, int level)[] rows)
    {
        var d = new Dictionary<string, Dictionary<string, string>>
        {
            [SupplyParser.ColClass] = [], [SupplyParser.ColType] = [], [SupplyParser.ColDescription] = [],
            [SupplyParser.ColMaxCapacity] = [], [SupplyParser.ColLevel] = [],
        };
        foreach (var r in rows)
        {
            if (r.cls is { } c) d[SupplyParser.ColClass][$"{SupplyParser.ColClass}.{r.row}"] = c.ToString();
            d[SupplyParser.ColType][$"{SupplyParser.ColType}.{r.row}"] = r.type.ToString();
            d[SupplyParser.ColDescription][$"{SupplyParser.ColDescription}.{r.row}"] = r.desc;
            d[SupplyParser.ColMaxCapacity][$"{SupplyParser.ColMaxCapacity}.{r.row}"] = r.max.ToString();
            d[SupplyParser.ColLevel][$"{SupplyParser.ColLevel}.{r.row}"] = r.level.ToString();
        }
        return d.ToDictionary(k => k.Key, k => (IReadOnlyDictionary<string, string>)k.Value);
    }

    [Fact] public void ComputesPercentAndColour()
    {
        var s = SupplyParser.Parse(Cols(("1.1", 3, 3, "Black Toner Cartridge", 3000, 750), ("1.2", 3, 5, "Cyan Ink", 100, 40)));
        Assert.Contains(new Supply("toner", "black", 25, "actual"), s);
        Assert.Contains(new Supply("ink", "cyan", 40, "actual"), s);
    }

    [Theory] [InlineData(-3)] [InlineData(-2)] [InlineData(-1)]
    public void SpecialLevelsAreUnsupportedNeverZero(int level)
    {
        var s = Assert.Single(SupplyParser.Parse(Cols(("1.1", 3, 3, "Black Toner", 100, level))));
        Assert.Null(s.Level);
        Assert.Equal("unsupported", s.Source);
    }

    [Fact] public void UnknownCapacityIsUnsupported()
    {
        var s = Assert.Single(SupplyParser.Parse(Cols(("1.1", 3, 3, "Black Toner", -2, 50))));
        Assert.Null(s.Level);
    }

    [Fact] public void SkipsWasteReceptacles()
    {
        var s = SupplyParser.Parse(Cols(("1.1", 4, 4, "Waste Toner Box", 100, 90), ("1.2", 3, 3, "Black Toner", 100, 80)));
        Assert.Equal(["toner"], s.Select(x => x.Type));
    }

    [Fact] public void DuplicateTypeAndColourKeepsLowestKnown()
    {
        var s = Assert.Single(SupplyParser.Parse(Cols(("1.1", 3, 3, "Black Toner", 100, 80), ("1.2", 3, 3, "Black Toner B", 100, 10), ("1.3", 3, 3, "Black Toner C", 100, -3))));
        Assert.Equal(10, s.Level);
    }

    [Fact] public void ClampsOverfullReadings() =>
        Assert.Equal(100, Assert.Single(SupplyParser.Parse(Cols(("1.1", 3, 3, "Black", 100, 150)))).Level);

    [Fact] public void MissingClassColumnIsAccepted() =>
        Assert.Single(SupplyParser.Parse(Cols(("1.1", null, 3, "Black", 100, 50))));

    [Theory]
    [InlineData("Magenta Toner", "magenta")] [InlineData("YELLOW", "yellow")] [InlineData("Tri-colour", "colour")]
    [InlineData("Imaging unit", "other")] [InlineData(null, "other")]
    public void ColourFromDescription(string? d, string expected) => Assert.Equal(expected, SupplyParser.ColourOf(d));

    [Fact] public void QueueNameParsing()
    {
        Assert.Equal("HP LaserJet", QueueNameParser.PrinterOf("HP LaserJet, 12"));
        Assert.Equal("Shop, Front desk", QueueNameParser.PrinterOf("Shop, Front desk, 7"));
        Assert.Null(QueueNameParser.PrinterOf("garbage"));
        Assert.Null(QueueNameParser.PrinterOf("Printer, x"));
        Assert.Null(QueueNameParser.PrinterOf(null));
    }

    [Fact] public void PageCountParsing()
    {
        Assert.Equal(1234, SupplyParser.ParsePageCount(new Dictionary<string, string> { ["x"] = "1234" }));
        Assert.Null(SupplyParser.ParsePageCount(new Dictionary<string, string>()));
        Assert.Null(SupplyParser.ParsePageCount(new Dictionary<string, string> { ["x"] = "-1" }));
    }
}

public class WorkerTests
{
    static PrinterInfo Net(string name = "HP", string? ip = "192.168.1.50") =>
        new($"{name}|IP_{ip}", name, null, "HP Driver", ConnectionType.Network, ip, "HP Driver", PrinterStatus.Ready, null);

    static FakeWalker WalkerWithToner() => new(new()
    {
        [SupplyParser.ColType] = new() { [$"{SupplyParser.ColType}.1.1"] = "3" },
        [SupplyParser.ColDescription] = new() { [$"{SupplyParser.ColDescription}.1.1"] = "Black Toner" },
        [SupplyParser.ColMaxCapacity] = new() { [$"{SupplyParser.ColMaxCapacity}.1.1"] = "100" },
        [SupplyParser.ColLevel] = new() { [$"{SupplyParser.ColLevel}.1.1"] = "42" },
        [SupplyParser.LifeCount] = new() { [$"{SupplyParser.LifeCount}.1.1"] = "9000" },
    });

    sealed class Lifetime : IHostApplicationLifetime
    {
        public CancellationToken ApplicationStarted => default;
        public CancellationToken ApplicationStopping => default;
        public CancellationToken ApplicationStopped => default;
        public void StopApplication() { }
    }

    static PollWorker Worker(FakeCloud cloud, IPrinterSource printers, FakeWalker walker) =>
        new(null!, cloud, printers, walker, new Lifetime(), NullLogger<PollWorker>.Instance);

    [Fact] public async Task NetworkPrinterGetsSuppliesAndPageCount()
    {
        var cloud = new FakeCloud();
        await Worker(cloud, new FakePrinters(Net()), WalkerWithToner()).CycleAsync("cred", default);
        var r = Assert.Single(Assert.Single(cloud.Sent));
        Assert.Equal("id-1", r.PrinterId);
        Assert.Equal(9000, r.PageCount);
        Assert.Equal(new Cloud.ConsumableDto("toner", "black", 42, "actual"), Assert.Single(r.Consumables));
    }

    [Fact] public async Task QueueDepthIsForwardedAndUnknownStaysNull()
    {
        var cloud = new FakeCloud();
        var counted = Net() with { QueuedJobs = 4 };
        await Worker(cloud, new FakePrinters(counted), WalkerWithToner()).CycleAsync("cred", default);
        Assert.Equal(4, Assert.Single(Assert.Single(cloud.Sent)).QueuedJobs);
        var cloud2 = new FakeCloud();
        await Worker(cloud2, new FakePrinters(Net()), WalkerWithToner()).CycleAsync("cred", default);
        Assert.Null(Assert.Single(Assert.Single(cloud2.Sent)).QueuedJobs);
    }

    [Fact] public async Task UsbPrinterSendsStatusOnlyAndNeverTouchesNetwork()
    {
        var usb = new PrinterInfo("Brother|USB001", "Brother", null, null, ConnectionType.Usb, null, null, PrinterStatus.Error, "Paper jam");
        var cloud = new FakeCloud(); var walker = WalkerWithToner();
        await Worker(cloud, new FakePrinters(usb), walker).CycleAsync("cred", default);
        var r = Assert.Single(Assert.Single(cloud.Sent));
        Assert.Equal("error", r.Status);
        Assert.Empty(r.Consumables);
        Assert.Empty(walker.Hosts);
    }

    [Fact] public async Task RegistersOnceAcrossCycles()
    {
        var cloud = new FakeCloud(); var w = Worker(cloud, new FakePrinters(Net()), WalkerWithToner());
        await w.CycleAsync("c", default); await w.CycleAsync("c", default);
        Assert.Equal(1, cloud.Registers);
        Assert.Equal(2, cloud.Sent.Count);
    }

    [Fact] public async Task ReRegistersAfterPrinterWasRemovedInTheApp()
    {
        var cloud = new FakeCloud(); var w = Worker(cloud, new FakePrinters(Net()), WalkerWithToner());
        await w.CycleAsync("c", default);
        cloud.NextRejects = [new Cloud.Rejected("id-1", "unknown_printer")];
        await w.CycleAsync("c", default);
        await w.CycleAsync("c", default);
        Assert.Equal(2, cloud.Registers);
        Assert.Equal("id-2", cloud.Sent[^1][0].PrinterId);
    }

    sealed class ThrowingWalker : ISnmpWalker
    {
        public Task<IReadOnlyDictionary<string, string>> WalkAsync(string host, string community, string rootOid, CancellationToken ct) =>
            throw new InvalidOperationException("bad device");
    }

    [Fact] public async Task OneBrokenPrinterStillReportsStatus()
    {
        var cloud = new FakeCloud();
        await Worker(cloud, new FakePrinters(Net("A"), Net("B", "10.0.0.9")), new FakeWalker(new())).CycleAsync("c", default);
        Assert.Equal(2, Assert.Single(cloud.Sent).Count);
        var broken = new PollWorker(null!, cloud, new FakePrinters(Net()), new ThrowingWalker(), new Lifetime(), NullLogger<PollWorker>.Instance);
        await broken.CycleAsync("c", default);
        var r = Assert.Single(cloud.Sent[^1]);
        Assert.Equal("ready", r.Status);
        Assert.Empty(r.Consumables);
    }

    [Fact] public async Task UnreachablePrinterStopsAfterFirstWalk()
    {
        var walker = new FakeWalker(new());
        await SupplyParser.ReadAsync(walker, "10.0.0.1", "public", default);
        Assert.Single(walker.Hosts);
    }

    [Fact] public async Task NoPrintersSendsNothing()
    {
        var cloud = new FakeCloud();
        await Worker(cloud, new FakePrinters(), WalkerWithToner()).CycleAsync("c", default);
        Assert.Empty(cloud.Sent);
    }
}
