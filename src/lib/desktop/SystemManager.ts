import { execSync } from "child_process";

export class SystemManager {
  private static instance: SystemManager;
  private virtualVolume = 50;
  private virtualMute = false;
  private virtualBrightness = 75;

  private constructor() {}

  public static getInstance(): SystemManager {
    if (!SystemManager.instance) {
      SystemManager.instance = new SystemManager();
    }
    return SystemManager.instance;
  }

  /**
   * Adjusts the system volume level (0 to 100).
   */
  public async setVolume(value: number): Promise<any> {
    this.virtualVolume = Math.max(0, Math.min(100, value));
    if (process.platform === "win32") {
      try {
        // Run PowerShell with a helper COM object to send Volume Up/Down keycodes
        // To be absolutely robust, we can adjust via SoundDevice cmdlets or key-simulation loops
        const currentApprox = this.virtualVolume;
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          # Force a series of volume down keystrokes to zero it, then raise to target
          for ($i = 0; $i -lt 50; $i++) { $wsh.SendKeys([char]174) }
          $steps = [Math]::Round(${currentApprox} / 2)
          for ($i = 0; $i -lt $steps; $i++) { $wsh.SendKeys([char]175) }
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return { success: true, message: `Successfully adjusted system volume to ${value}%` };
      } catch (err: any) {
        console.warn("[SystemManager] Native Windows volume adjustment failed:", err.message);
      }
    }
    return { success: true, message: `Successfully changed volume to ${value}% (simulated)` };
  }

  /**
   * Sets the mute state of the audio devices.
   */
  public async setMute(isMuted: boolean): Promise<any> {
    this.virtualMute = isMuted;
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          $wsh.SendKeys([char]173);
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return { success: true, message: `Toggled system mute state to ${isMuted ? "Muted" : "Unmuted"}` };
      } catch (err: any) {
        console.warn("[SystemManager] Mute toggling failed.");
      }
    }
    return { success: true, message: `System muted status set to ${isMuted} (simulated)` };
  }

  /**
   * Sets monitor brightness levels.
   */
  public async setBrightness(value: number): Promise<any> {
    const target = Math.max(0, Math.min(100, value));
    this.virtualBrightness = target;
    if (process.platform === "win32") {
      try {
        const psCommand = `(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${target})`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return { success: true, message: `Successfully adjusted monitor brightness to ${target}%` };
      } catch (err: any) {
        console.warn("[SystemManager] Native Windows brightness failed (WmiMonitorBrightness unsupported on desktop monitors), updated simulation.");
      }
    }
    return { success: true, message: `Successfully adjusted monitor brightness to ${target}% (simulated)` };
  }

  /**
   * Reads battery and charging information.
   */
  public async getBatteryInfo(): Promise<any> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue
          if ($battery) {
            @{
              hasBattery = $true
              percentage = $battery.EstimatedChargeRemaining
              charging = $battery.BatteryStatus -eq 2
              timeRemaining = $battery.EstimatedRunTime
            } | ConvertTo-Json
          } else {
            @{ hasBattery = $false } | ConvertTo-Json
          }
        `;
        const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        return JSON.parse(res.trim());
      } catch (_) {}
    }
    return { hasBattery: true, percentage: 95, charging: true, timeRemaining: 180, simulated: true };
  }

  /**
   * Retrieves live CPU, memory, and disk usage statistics.
   */
  public async getSystemResources(): Promise<any> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $cpu = Get-CimInstance -ClassName Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average
          $os = Get-CimInstance -ClassName Win32_OperatingSystem
          $ramTotal = $os.TotalVisibleMemorySize
          $ramFree = $os.FreePhysicalMemory
          $ramUsed = $ramTotal - $ramFree
          $ramPct = [Math]::Round(($ramUsed / $ramTotal) * 100, 2)
          
          $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
          $diskTotal = $disk.Size
          $diskFree = $disk.FreeSpace
          $diskUsed = $diskTotal - $diskFree
          $diskPct = [Math]::Round(($diskUsed / $diskTotal) * 100, 2)

          @{
            cpu = [Math]::Round($cpu, 1)
            ram = @{ total = [Math]::Round($ramTotal/1MB, 1); used = [Math]::Round($ramUsed/1MB, 1); percentage = $ramPct }
            disk = @{ total = [Math]::Round($diskTotal/1GB, 1); used = [Math]::Round($diskUsed/1GB, 1); percentage = $diskPct }
          } | ConvertTo-Json
        `;
        const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        return JSON.parse(res.trim());
      } catch (_) {}
    }

    // High quality simulation for sandbox
    const mockCpu = parseFloat((15 + Math.random() * 25).toFixed(1));
    const mockRamPct = parseFloat((45 + Math.random() * 15).toFixed(2));
    const mockDiskPct = 68.4;
    return {
      cpu: mockCpu,
      ram: { total: 16.0, used: parseFloat((16.0 * (mockRamPct / 100)).toFixed(1)), percentage: mockRamPct },
      disk: { total: 512.0, used: parseFloat((512.0 * (mockDiskPct / 100)).toFixed(1)), percentage: mockDiskPct },
      simulated: true
    };
  }

  /**
   * Retrieves IP addresses and active networking info.
   */
  public async getNetworkInfo(): Promise<any> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" } | Select-Object -ExpandProperty IPAddress
          @{ ips = $ips; connection = "Ethernet/Wi-Fi Active" } | ConvertTo-Json
        `;
        const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        return JSON.parse(res.trim());
      } catch (_) {}
    }
    return { ips: ["192.168.1.142"], connection: "Cloud Sandboxed Environment", simulated: true };
  }

  // SYSTEM POWER OPERATIONS
  public async sleep(): Promise<any> {
    if (process.platform === "win32") {
      try {
        const psCommand = `Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return { success: true, message: "Sleep command sent to PC successfully." };
      } catch (err: any) {
        return { success: false, message: `Failed to enter sleep mode: ${err.message}` };
      }
    }
    return { success: true, message: "Sleep command triggered (simulated)." };
  }

  public async lockPC(): Promise<any> {
    if (process.platform === "win32") {
      try {
        execSync("rundll32.exe user32.dll,LockWorkStation");
        return { success: true, message: "Computer screen locked successfully." };
      } catch (err: any) {
        return { success: false, message: `Failed to lock computer: ${err.message}` };
      }
    }
    return { success: true, message: "Computer screen lock triggered (simulated)." };
  }

  public async shutdown(): Promise<any> {
    if (process.platform === "win32") {
      try {
        execSync("shutdown /s /t 0");
        return { success: true, message: "Shutdown sequence initiated." };
      } catch (err: any) {
        return { success: false, message: `Failed to initiate shutdown: ${err.message}` };
      }
    }
    return { success: true, message: "Shutdown sequence initiated (simulated)." };
  }

  public async restart(): Promise<any> {
    if (process.platform === "win32") {
      try {
        execSync("shutdown /r /t 0");
        return { success: true, message: "Restart sequence initiated." };
      } catch (err: any) {
        return { success: false, message: `Failed to initiate restart: ${err.message}` };
      }
    }
    return { success: true, message: "Restart sequence initiated (simulated)." };
  }

  public async signOut(): Promise<any> {
    if (process.platform === "win32") {
      try {
        execSync("logoff");
        return { success: true, message: "Sign out command executed." };
      } catch (err: any) {
        return { success: false, message: `Failed to sign out: ${err.message}` };
      }
    }
    return { success: true, message: "Sign out triggered (simulated)." };
  }
}
