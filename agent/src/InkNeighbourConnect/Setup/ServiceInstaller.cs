using System.Diagnostics;
using System.Runtime.Versioning;
using System.Security.Principal;
using System.ServiceProcess;

namespace InkNeighbourConnect.Setup;

// Installs the running exe as a Windows service. Fixed arguments only: nothing here comes from the user or the network.
[SupportedOSPlatform("windows")]
public static class ServiceInstaller
{
    public const string ServiceName = "InkNeighbourConnect";

    public static string InstallDir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "InkNeighbourConnect");

    public static string InstalledExe => Path.Combine(InstallDir, "InkNeighbourConnect.exe");

    public static bool IsAdministrator() =>
        new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);

    public static void Install()
    {
        var source = Environment.ProcessPath ?? throw new InvalidOperationException("Cannot find this program's own file.");
        StopIfRunning();
        Directory.CreateDirectory(InstallDir);
        if (!string.Equals(Path.GetFullPath(source), Path.GetFullPath(InstalledExe), StringComparison.OrdinalIgnoreCase))
            File.Copy(source, InstalledExe, overwrite: true);

        if (!Exists())
        {
            Sc("create", ServiceName, "binPath=", InstalledExe, "start=", "auto", "DisplayName=", "InkNeighbour Connect");
            Sc("description", ServiceName, "Reports printer status and supply levels to InkNeighbour (read-only).");
            Sc("failure", ServiceName, "reset=", "86400", "actions=", "restart/60000/restart/60000/restart/60000");
        }
        using var svc = new ServiceController(ServiceName);
        svc.Start();
        svc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
    }

    public static void Uninstall()
    {
        StopIfRunning();
        if (Exists()) Sc("delete", ServiceName);
        TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "InkNeighbourConnect"));
        TryDelete(InstallDir);
    }

    private static bool Exists() => ServiceController.GetServices().Any(s => s.ServiceName == ServiceName);

    private static void StopIfRunning()
    {
        if (!Exists()) return;
        using var svc = new ServiceController(ServiceName);
        if (svc.Status == ServiceControllerStatus.Stopped) return;
        svc.Stop();
        svc.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
    }

    // The running installed exe cannot delete itself; it is left behind harmlessly.
    private static void TryDelete(string dir)
    {
        try { Directory.Delete(dir, recursive: true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }

    private static void Sc(params string[] args)
    {
        var psi = new ProcessStartInfo("sc.exe") { CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var p = Process.Start(psi) ?? throw new InvalidOperationException("Could not run sc.exe.");
        p.StandardOutput.ReadToEnd();
        p.WaitForExit();
        if (p.ExitCode != 0) throw new InvalidOperationException($"sc.exe {args[0]} failed (code {p.ExitCode}).");
    }
}
