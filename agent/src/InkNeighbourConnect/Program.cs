using InkNeighbourConnect.Cloud;
using InkNeighbourConnect.Config;
using InkNeighbourConnect.Printers;
using InkNeighbourConnect.Setup;
using Microsoft.Extensions.Hosting.WindowsServices;
using InkNeighbourConnect.Snmp;
using InkNeighbourConnect.Worker;

// Usage:
//   InkNeighbourConnect                          double-click: asks for the code, pairs and installs the service
//   InkNeighbourConnect install [code]           same, with the code on the command line
//   InkNeighbourConnect uninstall                remove the service, files and stored credential
//   InkNeighbourConnect pair <code> [--url <u>]  pair only (one time)
//   InkNeighbourConnect run                      run in a console instead of as a service
const string DefaultEndpoint = "https://xgjaagaqtzknvsinbklr.supabase.co/functions/v1/printer-agent";

var store = new FileCredentialStore(Environment.GetEnvironmentVariable("INKCONNECT_STATE") ?? FileCredentialStore.DefaultPath);

async Task<int> PairAsync(string? code, Uri url)
{
    if (string.IsNullOrWhiteSpace(code)) { Console.Error.WriteLine("Usage: InkNeighbourConnect pair <code>"); return 2; }
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

if (args.Length >= 1 && args[0] == "pair")
{
    var urlIdx = Array.IndexOf(args, "--url");
    return await PairAsync(args.ElementAtOrDefault(1), new Uri(urlIdx >= 0 && urlIdx + 1 < args.Length ? args[urlIdx + 1] : DefaultEndpoint));
}

// Double-click (no arguments, not started by the service manager) or the explicit install/uninstall commands.
if (OperatingSystem.IsWindows()
    && (args is ["install", ..] or ["uninstall"] || (args.Length == 0 && !WindowsServiceHelpers.IsWindowsService())))
{
    var guided = args.Length == 0;
    var exit = 0;
    try
    {
        if (!ServiceInstaller.IsAdministrator()) throw new InvalidOperationException("Please run this as Administrator.");
        if (args is ["uninstall"])
        {
            ServiceInstaller.Uninstall();
            Console.WriteLine("InkNeighbour Connect was removed. Also remove this computer on the My Printers page.");
        }
        else
        {
            Console.WriteLine("InkNeighbour Connect");
            Console.WriteLine("Reports your printer status and ink levels to InkNeighbour. It never prints or changes printer settings.\n");
            var code = args.ElementAtOrDefault(1);
            if (string.IsNullOrWhiteSpace(code))
            {
                Console.Write("Type the code shown on the InkNeighbour My Printers page: ");
                code = Console.ReadLine();
            }
            exit = await PairAsync(code, new Uri(DefaultEndpoint));
            if (exit == 0)
            {
                ServiceInstaller.Install();
                Console.WriteLine("Installed and running. Your printers will appear on My Printers within a minute.");
            }
        }
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"Setup could not finish: {e.Message}");
        exit = 1;
    }
    if (guided) { Console.WriteLine("\nPress Enter to close."); Console.ReadLine(); }
    return exit;
}

var state = store.Load();
var builder = Host.CreateApplicationBuilder(args.Where(a => a != "run").ToArray());
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
