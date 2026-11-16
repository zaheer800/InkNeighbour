using System.Management;
using System.Runtime.Versioning;

namespace InkNeighbourConnect.Printers;

// Reads installed printers from WMI. Read-only: it never sends anything to a printer.
[SupportedOSPlatform("windows")]
public sealed class WindowsPrinterSource : IPrinterSource
{
    public IReadOnlyList<PrinterInfo> GetPrinters()
    {
        var hosts = LoadPortHosts();
        var jobs = LoadQueueDepths();
        var result = new List<PrinterInfo>();
        using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_Printer");
        foreach (ManagementObject p in searcher.Get())
        {
            using (p)
            {
                var name = p["Name"] as string;
                if (string.IsNullOrWhiteSpace(name) || IsVirtual(p)) continue;
                var port = p["PortName"] as string ?? "";
                var driver = p["DriverName"] as string;
                var (status, detail) = StatusMapper.Map(
                    Convert.ToInt32(p["PrinterStatus"] ?? 2),
                    Convert.ToInt32(p["DetectedErrorState"] ?? 0),
                    p["WorkOffline"] as bool? ?? false);
                hosts.TryGetValue(port, out var ip);
                var connection = ip is not null ? ConnectionType.Network
                    : port.StartsWith("USB", StringComparison.OrdinalIgnoreCase) ? ConnectionType.Usb
                    : ConnectionType.Other;
                result.Add(new PrinterInfo(
                    DeviceIdentifier: $"{Environment.MachineName}|{name}|{port}",
                    Name: name, Manufacturer: null, Model: driver, Connection: connection,
                    IpAddress: ip, DriverInfo: driver, Status: status, StatusDetail: detail,
                    QueuedJobs: jobs is null ? null : jobs.GetValueOrDefault(name)));
            }
        }
        return result;
    }

    // Software "printers" (PDF, XPS, OneNote, fax) are not physical devices and would only add noise.
    private static bool IsVirtual(ManagementObject p)
    {
        var port = (p["PortName"] as string ?? "").ToUpperInvariant();
        var driver = (p["DriverName"] as string ?? "").ToLowerInvariant();
        return port is "NUL:" or "PORTPROMPT:" or "FILE:" or "SHRFAX:" or "NULL"
            || port.StartsWith("PORTPROMPT") || port.StartsWith("XPSPORT")
            || driver is "microsoft print to pdf" or "microsoft xps document writer" or "microsoft shared fax driver"
            || driver.StartsWith("send to onenote") || driver.StartsWith("onenote");
    }

    // Jobs waiting in each Windows print queue. Null when the queue cannot be read, so "unknown" is never shown as 0.
    private static Dictionary<string, int>? LoadQueueDepths()
    {
        try
        {
            var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            using var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_PrintJob");
            foreach (ManagementObject job in searcher.Get())
            {
                using (job)
                {
                    var printer = QueueNameParser.PrinterOf(job["Name"] as string);
                    if (printer is not null) map[printer] = map.GetValueOrDefault(printer) + 1;
                }
            }
            return map;
        }
        catch (ManagementException) { return null; }
    }

    private static Dictionary<string, string> LoadPortHosts()
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        using var searcher = new ManagementObjectSearcher("SELECT Name, HostAddress FROM Win32_TCPIPPrinterPort");
        foreach (ManagementObject port in searcher.Get())
        {
            using (port)
            {
                if (port["Name"] is string n && port["HostAddress"] is string h && !string.IsNullOrWhiteSpace(h))
                    map[n] = h;
            }
        }
        return map;
    }
}
