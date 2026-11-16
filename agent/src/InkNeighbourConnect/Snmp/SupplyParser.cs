namespace InkNeighbourConnect.Snmp;

public sealed record Supply(string Type, string Colour, int? Level, string Source);

public interface ISnmpWalker
{
    // Returns every variable under rootOid as full-OID -> value text. Empty when the device does not answer.
    Task<IReadOnlyDictionary<string, string>> WalkAsync(string host, string community, string rootOid, CancellationToken ct);
}

// Turns Printer MIB (RFC 3805) prtMarkerSuppliesTable rows into supplies the cloud understands.
public static class SupplyParser
{
    public const string SuppliesBase = "1.3.6.1.2.1.43.11.1.1";
    public const string ColClass = SuppliesBase + ".4";
    public const string ColType = SuppliesBase + ".5";
    public const string ColDescription = SuppliesBase + ".6";
    public const string ColMaxCapacity = SuppliesBase + ".8";
    public const string ColLevel = SuppliesBase + ".9";
    public const string LifeCount = "1.3.6.1.2.1.43.10.2.1.4";

    private static readonly string[] Columns = [ColClass, ColType, ColDescription, ColMaxCapacity, ColLevel];

    public static async Task<(IReadOnlyList<Supply> Supplies, int? PageCount)> ReadAsync(
        ISnmpWalker walker, string host, string community, CancellationToken ct)
    {
        var cols = new Dictionary<string, IReadOnlyDictionary<string, string>>();
        foreach (var c in Columns) cols[c] = await walker.WalkAsync(host, community, c, ct);
        var life = await walker.WalkAsync(host, community, LifeCount, ct);
        return (Parse(cols), ParsePageCount(life));
    }

    public static int? ParsePageCount(IReadOnlyDictionary<string, string> life)
    {
        foreach (var v in life.Values)
            if (int.TryParse(v, out var n) && n >= 0) return n;
        return null;
    }

    public static IReadOnlyList<Supply> Parse(IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> cols)
    {
        var rows = cols.GetValueOrDefault(ColLevel)?.Keys.Select(k => k[(ColLevel.Length + 1)..]).ToList() ?? [];
        var best = new Dictionary<(string, string), Supply>();
        foreach (var row in rows)
        {
            string? Cell(string col) => cols.GetValueOrDefault(col)?.GetValueOrDefault($"{col}.{row}");
            var cls = Int(Cell(ColClass));
            var typeCode = Int(Cell(ColType));
            // Waste receptacles report how full they are, not how much is left, so they are not supplies.
            if (cls == 4 || typeCode is 4 or 8) continue;

            var type = typeCode switch { 3 => "toner", 5 or 6 => "ink", 9 => "drum", _ => "other" };
            var colour = ColourOf(Cell(ColDescription));
            var level = Int(Cell(ColLevel));
            var max = Int(Cell(ColMaxCapacity));
            // -1 other, -2 unknown, -3 "some remaining": none of these is a percentage we can show.
            var supply = level is >= 0 && max is > 0
                ? new Supply(type, colour, Math.Clamp((int)Math.Round(level.Value * 100.0 / max.Value), 0, 100), "actual")
                : new Supply(type, colour, null, "unsupported");

            // The cloud rejects a reading with two supplies of the same type and colour, so keep the lowest known.
            var key = (type, colour);
            if (!best.TryGetValue(key, out var existing) || Rank(supply) < Rank(existing)) best[key] = supply;
        }
        return best.Values.Take(16).ToList();
    }

    private static int Rank(Supply s) => s.Level ?? 1000;

    private static int? Int(string? s) => int.TryParse(s, out var n) ? n : null;

    public static string ColourOf(string? description)
    {
        var d = (description ?? "").ToLowerInvariant();
        if (d.Contains("black")) return "black";
        if (d.Contains("cyan")) return "cyan";
        if (d.Contains("magenta")) return "magenta";
        if (d.Contains("yellow")) return "yellow";
        if (d.Contains("colour") || d.Contains("color") || d.Contains("tri-")) return "colour";
        return "other";
    }
}
