namespace InkNeighbourConnect.Printers;

public enum PrinterStatus { Ready, Busy, Error, Offline, Unknown }

public enum ConnectionType { Usb, Network, Other }

public sealed record PrinterInfo(
    string DeviceIdentifier,
    string Name,
    string? Manufacturer,
    string? Model,
    ConnectionType Connection,
    string? IpAddress,
    string? DriverInfo,
    PrinterStatus Status,
    string? StatusDetail);

public interface IPrinterSource
{
    IReadOnlyList<PrinterInfo> GetPrinters();
}
