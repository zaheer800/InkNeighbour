using InkNeighbourConnect.Cloud;
using InkNeighbourConnect.Config;
using InkNeighbourConnect.Printers;
using InkNeighbourConnect.Snmp;
using InkNeighbourConnect.Worker;

// Usage:
//   InkNeighbourConnect pair <code> [--url <function url>]   pair this computer (one time)
//   InkNeighbourConnect                                      run (as a Windows service or in a console)
const string DefaultEndpoint = "https://xgjaagaqtzknvsinbklr.supabase.co/functions/v1/printer-agent";

var store = new FileCredentialStore(Environment.GetEnvironmentVariable("INKCONNECT_STATE") ?? FileCredentialStore.DefaultPath);

if (args.Length >= 1 && args[0] == "pair")
{
    var code = args.ElementAtOrDefault(1);
    if (string.IsNullOrWhiteSpace(code)) { Console.Error.WriteLine("Usage: InkNeighbourConnect pair <code>"); return 2; }
    var urlIdx = Array.IndexOf(args, "--url");
    var url = new Uri(urlIdx >= 0 && urlIdx + 1 < args.Length ? args[urlIdx + 1] : DefaultEndpoint);
    if (url.Scheme != Uri.UriSchemeHttps && !url.IsLoopback) { Console.Error.WriteLine("The URL must be https."); return 2; }
    try
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        var r = await new CloudClient(http, url).PairAsync(code, Environment.MachineName, PollWorker.Version, CancellationToken.None);
        store.Save(new AgentState(r.Credential, url));
        Console.WriteLine("Paired. This computer is now connected to InkNeighbour.");
        return 0;
    }
    catch (CloudException e) when (e.Code == "invalid_or_expired_code")
    {
        Console.Error.WriteLine("That code did not work. It may have expired. Make a new one in InkNeighbour and try again.");
        return 1;
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"Could not pair: {e.Message}");
        return 1;
    }
}

var state = store.Load();
var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(o => o.ServiceName = "InkNeighbourConnect");
builder.Services.AddSingleton<ICredentialStore>(store);
builder.Services.AddSingleton<ICloudClient>(_ =>
    new CloudClient(new HttpClient { Timeout = TimeSpan.FromSeconds(30) }, state?.Endpoint ?? new Uri(DefaultEndpoint)));
builder.Services.AddSingleton<IPrinterSource>(_ =>
    OperatingSystem.IsWindows() ? new WindowsPrinterSource() : new NoPrinterSource());
builder.Services.AddSingleton<ISnmpWalker, SharpSnmpWalker>();
builder.Services.AddHostedService<PollWorker>();
await builder.Build().RunAsync();
return 0;

// On non-Windows machines (development only) there is nothing to read.
file sealed class NoPrinterSource : IPrinterSource
{
    public IReadOnlyList<PrinterInfo> GetPrinters() => [];
}
