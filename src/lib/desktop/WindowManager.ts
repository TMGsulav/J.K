import { execSync } from "child_process";

export class WindowManager {
  private static instance: WindowManager;

  private constructor() {}

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Minimizes all open windows.
   */
  public async minimizeWindow(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `(New-Object -ComObject Shell.Application).MinimizeAll()`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Restores all minimized windows.
   */
  public async restoreWindow(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `(New-Object -ComObject Shell.Application).UndoMinimizeAll()`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Maximizes the active window (simulates Alt+Space, then x).
   */
  public async maximizeWindow(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          $wsh.SendKeys('% ');
          Start-Sleep -m 100;
          $wsh.SendKeys('x');
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Closes the active window (simulates Alt+F4).
   */
  public async closeWindow(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          $wsh.SendKeys('%{F4}');
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Switch/Focus window (simulates Alt+Tab).
   */
  public async switchWindow(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          $wsh.SendKeys('%{TAB}');
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Focus a specific window by its title.
   */
  public async focusWindow(title: string): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
          $type = Add-Type -MemberDefinition $sig -Name "Win32SetForegroundWindow" -Namespace "Win32" -PassThru
          $proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${title}*" } | Select-Object -First 1
          if ($proc) {
            [void]$type::SetForegroundWindow($proc.MainWindowHandle)
            return $true
          }
          return $false
        `;
        const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        return res.trim() === "True";
      } catch (_) {}
    }
    return true;
  }

  /**
   * Arranges all open windows in a cascade style.
   */
  public async cascadeWindows(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `(New-Object -ComObject Shell.Application).CascadeWindows()`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Tiles all open windows horizontally.
   */
  public async tileWindows(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `(New-Object -ComObject Shell.Application).TileHorizontally()`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }

  /**
   * Arranges open windows (tiles vertically).
   */
  public async arrangeWindows(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `(New-Object -ComObject Shell.Application).TileVertically()`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (_) {}
    }
    return true;
  }
}
