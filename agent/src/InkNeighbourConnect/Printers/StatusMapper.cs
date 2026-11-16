namespace InkNeighbourConnect.Printers;

// Maps Win32_Printer fields to the status vocabulary the cloud function accepts.
public static class StatusMapper
{
    // Win32_Printer.PrinterStatus: 1 Other, 2 Unknown, 3 Idle, 4 Printing, 5 Warmup, 6 Stopped printing, 7 Offline
    // Win32_Printer.DetectedErrorState: 0 Unknown, 1 Other, 2 No error, 3 Low paper, 4 No paper, 5 Low toner,
    // 6 No toner, 7 Door open, 8 Jammed, 9 Offline, 10 Service requested, 11 Output bin full
    public static (PrinterStatus Status, string? Detail) Map(int printerStatus, int detectedErrorState, bool workOffline)
    {
        if (workOffline || printerStatus == 7 || detectedErrorState == 9)
            return (PrinterStatus.Offline, null);

        var detail = detectedErrorState switch
        {
            4 => "Out of paper",
            6 => "Out of toner",
            7 => "Door or cover open",
            8 => "Paper jam",
            10 => "Service requested",
            11 => "Output bin full",
            _ => null,
        };
        if (detail is not null || printerStatus == 6)
            return (PrinterStatus.Error, detail ?? "Printing stopped");

        return printerStatus switch
        {
            3 => (PrinterStatus.Ready, null),
            4 or 5 => (PrinterStatus.Busy, null),
            _ => (PrinterStatus.Unknown, null),
        };
    }

    public static string ToWire(PrinterStatus s) => s switch
    {
        PrinterStatus.Ready => "ready",
        PrinterStatus.Busy => "busy",
        PrinterStatus.Error => "error",
        PrinterStatus.Offline => "offline",
        _ => "unknown",
    };
}
