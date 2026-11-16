using System.Net;
using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;

namespace InkNeighbourConnect.Snmp;

// SNMP v2c, read-only (GET-NEXT walks only). Never sends a SET.
public sealed class SharpSnmpWalker(TimeSpan? timeout = null) : ISnmpWalker
{
    private readonly TimeSpan _timeout = timeout ?? TimeSpan.FromSeconds(3);

    public async Task<IReadOnlyDictionary<string, string>> WalkAsync(
        string host, string community, string rootOid, CancellationToken ct)
    {
        var result = new Dictionary<string, string>();
        if (!IPAddress.TryParse(host, out var ip))
        {
            try { ip = (await Dns.GetHostAddressesAsync(host, ct)).FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork); }
            catch (Exception e) when (e is System.Net.Sockets.SocketException) { return result; }
            if (ip is null) return result;
        }
        var list = new List<Variable>();
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(_timeout);
            await Messenger.WalkAsync(
                VersionCode.V2, new IPEndPoint(ip, 161), new OctetString(community),
                new ObjectIdentifier(rootOid), list, WalkMode.WithinSubtree, cts.Token);
        }
        catch (Exception e) when (e is OperationCanceledException or Lextm.SharpSnmpLib.Messaging.TimeoutException
                                   or System.Net.Sockets.SocketException or Lextm.SharpSnmpLib.SnmpException)
        {
            ct.ThrowIfCancellationRequested();
            return result;
        }
        foreach (var v in list) result[v.Id.ToString().TrimStart('.')] = v.Data.ToString() ?? "";
        return result;
    }
}
