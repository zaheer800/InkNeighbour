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
        try
        {
            var s = JsonSerializer.Deserialize<Stored>(File.ReadAllText(path));
            if (s is null || string.IsNullOrEmpty(s.Credential)) return null;
            var credential = s.Protected ? Unprotect(s.Credential) : s.Credential;
            return new AgentState(credential, new Uri(s.Endpoint));
        }
        catch (Exception e) when (e is JsonException or FormatException or UriFormatException or CryptographicException or ArgumentException)
        {
            return null;
        }
    }

    public void Save(AgentState state)
    {
        var dir = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(dir);
        if (OperatingSystem.IsWindows()) RestrictDirectory(dir);
        var prot = OperatingSystem.IsWindows();
        var credential = prot ? Protect(state.Credential) : state.Credential;
        var json = JsonSerializer.Serialize(new Stored(credential, state.Endpoint.ToString(), prot));
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, json);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(tmp, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        File.Move(tmp, path, overwrite: true);
    }

    public void Clear()
    {
        if (File.Exists(path)) File.Delete(path);
    }

    // Only SYSTEM and Administrators may read the state; other local users must not be able to decrypt it.
    [SupportedOSPlatform("windows")]
    private static void RestrictDirectory(string dir)
    {
        var info = new DirectoryInfo(dir);
        var sec = new System.Security.AccessControl.DirectorySecurity();
        sec.SetAccessRuleProtection(true, false);
        foreach (var sid in new[] { System.Security.Principal.WellKnownSidType.LocalSystemSid, System.Security.Principal.WellKnownSidType.BuiltinAdministratorsSid })
            sec.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(
                new System.Security.Principal.SecurityIdentifier(sid, null),
                System.Security.AccessControl.FileSystemRights.FullControl,
                System.Security.AccessControl.InheritanceFlags.ContainerInherit | System.Security.AccessControl.InheritanceFlags.ObjectInherit,
                System.Security.AccessControl.PropagationFlags.None, System.Security.AccessControl.AccessControlType.Allow));
        info.SetAccessControl(sec);
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
