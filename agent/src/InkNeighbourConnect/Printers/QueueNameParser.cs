namespace InkNeighbourConnect.Printers;

public static class QueueNameParser
{
    // A Win32_PrintJob name is "<printer name>, <job id>"; printer names may themselves contain commas.
    public static string? PrinterOf(string? jobName)
    {
        if (string.IsNullOrWhiteSpace(jobName)) return null;
        var i = jobName.LastIndexOf(", ", StringComparison.Ordinal);
        if (i <= 0 || !int.TryParse(jobName.AsSpan(i + 2), out _)) return null;
        return jobName[..i];
    }
}
