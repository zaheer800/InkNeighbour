using InkNeighbourConnect.Cloud;
using InkNeighbourConnect.Printers;
using InkNeighbourConnect.Snmp;

namespace InkNeighbourConnect.Worker;

public static class ReadingBuilder
{
    // Only network printers answer SNMP. USB printers report the Windows status and no supplies.
    public static async Task<ReadingDto> BuildAsync(
        string printerId, PrinterInfo printer, ISnmpWalker walker, string community, DateTimeOffset now, CancellationToken ct)
    {
        IReadOnlyList<Supply> supplies = [];
        int? pages = null;
        if (printer is { Connection: ConnectionType.Network, IpAddress: { } ip })
            (supplies, pages) = await SupplyParser.ReadAsync(walker, ip, community, ct);

        return new ReadingDto(
            printerId, now, StatusMapper.ToWire(printer.Status), printer.StatusDetail, pages,
            supplies.Select(s => new ConsumableDto(s.Type, s.Colour, s.Level, s.Source)).ToList());
    }
}
