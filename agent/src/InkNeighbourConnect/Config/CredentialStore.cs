using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace InkNeighbourConnect.Config;

public sealed record AgentState(string Credential, Uri Endpoint);

public interface ICredentialStore
{
    AgentState? Load();
    void Save(AgentState state);
    void Clear();
}

// Stores the agent credential on disk. On Windows it is encrypted with DPAPI (machine scope) so a copy of
// the file is useless on another computer; elsewhere (tests) it is written with owner-only permissions.
public sealed class FileCredentialStore(string path) : ICredentialStore
{
    private sealed record Stored(string Credential, string Endpoint, bool Protected);

    public static string DefaultPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "InkNeighbourConnect", "agent.json");

    public AgentState? Load()
    {
        if (!File.Exists(path)) return null;
        var s = JsonSerializer.Deserialize<Stored>(File.ReadAllText(path));
        if (s is null) return null;
        var credential = s.Protected ? Unprotect(s.Credential) : s.Credential;
        return new AgentState(credential, new Uri(s.Endpoint));
    }

    public void Save(AgentState state)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var prot = OperatingSystem.IsWindows();
        var credential = prot ? Protect(state.Credential) : state.Credential;
        var json = JsonSerializer.Serialize(new Stored(credential, state.Endpoint.ToString(), prot));
        File.WriteAllText(path, json);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }

    public void Clear()
    {
        if (File.Exists(path)) File.Delete(path);
    }

    [SupportedOSPlatform("windows")]
    private static string ProtectWin(string s) =>
        Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(s), null, DataProtectionScope.LocalMachine));

    [SupportedOSPlatform("windows")]
    private static string UnprotectWin(string s) =>
        Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(s), null, DataProtectionScope.LocalMachine));

    private static string Protect(string s) =>
        OperatingSystem.IsWindows() ? ProtectWin(s) : throw new PlatformNotSupportedException();
    private static string Unprotect(string s) =>
        OperatingSystem.IsWindows() ? UnprotectWin(s) : throw new PlatformNotSupportedException("Credential was protected on Windows.");
}
