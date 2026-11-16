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
                    DeviceIdentifier: $"{name}|{port}",
                    Name: name, Manufacturer: null, Model: driver, Connection: connection,
                    IpAddress: ip, DriverInfo: driver, Status: status, StatusDetail: detail));
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
            || driver.Contains("pdf") || driver.Contains("xps") || driver.Contains("onenote") || driver.Contains("fax");
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
