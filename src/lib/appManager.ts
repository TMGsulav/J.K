import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export interface AppInfo {
  name: string;
  path: string;
}

export interface LaunchResult {
  success: boolean;
  appName: string;
  matchedName: string;
  path: string;
  message: string;
  error?: string;
  requiresDisambiguation?: boolean;
  matches?: string[];
  requiresConfirmation?: boolean;
}

export class AppManager {
  private static instance: AppManager;
  private appIndex: Record<string, string> = {};
  private customMappings: Record<string, string> = {};
  private mappingsFilePath: string;

  // Hardcoded standard system applications on Windows
  private readonly systemApps: Record<string, string> = {
    "notepad": "C:\\Windows\\System32\\notepad.exe",
    "notepad.exe": "C:\\Windows\\System32\\notepad.exe",
    "calc": "C:\\Windows\\System32\\calc.exe",
    "calculator": "C:\\Windows\\System32\\calc.exe",
    "calc.exe": "C:\\Windows\\System32\\calc.exe",
    "paint": "C:\\Windows\\System32\\mspaint.exe",
    "mspaint": "C:\\Windows\\System32\\mspaint.exe",
    "mspaint.exe": "C:\\Windows\\System32\\mspaint.exe",
    "explorer": "C:\\Windows\\explorer.exe",
    "file explorer": "C:\\Windows\\explorer.exe",
    "explorer.exe": "C:\\Windows\\explorer.exe",
    "cmd": "C:\\Windows\\System32\\cmd.exe",
    "command prompt": "C:\\Windows\\System32\\cmd.exe",
    "cmd.exe": "C:\\Windows\\System32\\cmd.exe",
    "task manager": "C:\\Windows\\System32\\taskmgr.exe",
    "taskmgr": "C:\\Windows\\System32\\taskmgr.exe",
    "taskmgr.exe": "C:\\Windows\\System32\\taskmgr.exe",
    "powershell": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    "powershell.exe": "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    "control panel": "C:\\Windows\\System32\\control.exe",
    "control": "C:\\Windows\\System32\\control.exe",
    "settings": "ms-settings:"
  };

  private constructor() {
    this.mappingsFilePath = path.join(process.cwd(), "app-mappings-v2.json");
    this.loadCustomMappings();
    this.buildIndex();
  }

  public static getInstance(): AppManager {
    if (!AppManager.instance) {
      AppManager.instance = new AppManager();
    }
    return AppManager.instance;
  }

  /**
   * Load custom saved application mappings from disk
   */
  private loadCustomMappings() {
    if (fs.existsSync(this.mappingsFilePath)) {
      try {
        const data = fs.readFileSync(this.mappingsFilePath, "utf-8");
        this.customMappings = JSON.parse(data);
        console.log(`[AppManager] Loaded ${Object.keys(this.customMappings).length} custom mappings.`);
      } catch (e: any) {
        console.error("[AppManager] Error reading custom mappings file:", e.message);
      }
    }
  }

  /**
   * Permanently save a custom application mapping
   */
  public saveCustomMapping(alias: string, fullPath: string) {
    const cleanAlias = alias.toLowerCase().trim();
    const cleanPath = path.normalize(fullPath.trim());
    this.customMappings[cleanAlias] = cleanPath;
    try {
      fs.writeFileSync(this.mappingsFilePath, JSON.stringify(this.customMappings, null, 2), "utf-8");
      console.log(`[AppManager] Saved custom mapping permanently: "${cleanAlias}" -> "${cleanPath}"`);
      // Update the active index
      this.appIndex[cleanAlias] = cleanPath;
    } catch (e: any) {
      console.error("[AppManager] Error saving custom mapping file:", e.message);
    }
  }

  /**
   * Re-scans system files and registry to rebuild the application index
   */
  public async rebuildIndex(): Promise<void> {
    console.log("[AppManager] Rebuilding application index on request...");
    await this.buildIndex();
  }

  /**
   * Builds the comprehensive index of installed apps on startup
   */
  private async buildIndex() {
    console.log("[AppManager] Building application index...");
    this.appIndex = { ...this.systemApps };

    // Apply standard system-level environment variables
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env["LocalAppData"] || path.join(process.env["USERPROFILE"] || "C:\\Users\\Default", "AppData\\Local");
    const appData = process.env["AppData"] || path.join(process.env["USERPROFILE"] || "C:\\Users\\Default", "AppData\\Roaming");

    // Pre-seed common installations to guarantee detection even without full scans
    const commonApps: Record<string, string> = {
      "chrome": path.join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
      "google chrome": path.join(programFiles, "Google\\Chrome\\Application\\chrome.exe"),
      "chrome_x86": path.join(programFilesX86, "Google\\Chrome\\Application\\chrome.exe"),
      "vscode": path.join(localAppData, "Programs\\Microsoft VS Code\\Code.exe"),
      "code": path.join(localAppData, "Programs\\Microsoft VS Code\\Code.exe"),
      "visual studio code": path.join(localAppData, "Programs\\Microsoft VS Code\\Code.exe"),
      "vscode_system": path.join(programFiles, "Microsoft VS Code\\Code.exe"),
      "spotify": path.join(appData, "Spotify\\Spotify.exe"),
      "spotify_local": path.join(localAppData, "Microsoft\\WindowsApps\\Spotify.exe"),
      "steam": path.join(programFilesX86, "Steam\\steam.exe"),
      "steam_system": path.join(programFiles, "Steam\\steam.exe"),
      "discord": path.join(localAppData, "Discord\\Update.exe") // update.exe launches Discord
    };

    for (const [key, val] of Object.entries(commonApps)) {
      if (fs.existsSync(val)) {
        this.appIndex[key.replace(/_.*$/, "")] = val;
      }
    }

    // Merge in custom mappings saved by user
    for (const [key, val] of Object.entries(this.customMappings)) {
      this.appIndex[key] = val;
    }

    // On Windows, use PowerShell to query registry and shortcut files asynchronously
    if (process.platform === "win32") {
      try {
        await this.scanWindowsAppsWithPowerShell();
      } catch (err: any) {
        console.error("[AppManager] Windows PowerShell scan failed, using fallback index:", err.message);
      }
    } else {
      console.log("[AppManager] Headless/Non-Windows host environment detected. Pre-seeding simulation indexes.");
      // Pre-seed some mock paths on non-Windows for seamless local testing
      this.appIndex["chrome"] = "/usr/bin/google-chrome";
      this.appIndex["google chrome"] = "/usr/bin/google-chrome";
      this.appIndex["vscode"] = "/usr/bin/code";
      this.appIndex["visual studio code"] = "/usr/bin/code";
      this.appIndex["code"] = "/usr/bin/code";
      this.appIndex["discord"] = "/usr/bin/discord";
      this.appIndex["spotify"] = "/usr/bin/spotify";
      this.appIndex["steam"] = "/usr/bin/steam";
    }

    console.log(`[AppManager] Finished building application index. Total searchable applications: ${Object.keys(this.appIndex).length}`);
  }

  /**
   * Scans registry and shortcut files via safe PowerShell spawn
   */
  private scanWindowsAppsWithPowerShell(): Promise<void> {
    return new Promise((resolve, reject) => {
      const psCommand = `
        $shell = New-Object -ComObject WScript.Shell
        $paths = @(
          "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
          "$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs",
          "$env:Public\\Desktop",
          "$env:UserProfile\\Desktop"
        )
        $apps = @()
        Get-ChildItem -Path $paths -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
          try {
            $lnk = $shell.CreateShortcut($_.FullName)
            $target = $lnk.TargetPath
            if ($target -and (Test-Path $target) -and $target.EndsWith(".exe")) {
              $apps += [PSCustomObject]@{
                name = $_.BaseName
                path = $target
              }
            }
          } catch {}
        }

        # Scan Uninstall registry for InstallLocations
        $registryPaths = @(
          "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
          "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
          "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
        )
        Get-ItemProperty $registryPaths -ErrorAction SilentlyContinue | ForEach-Object {
          if ($_.DisplayName -and $_.InstallLocation) {
            $installDir = $_.InstallLocation
            if (Test-Path $installDir) {
              $exes = Get-ChildItem -Path $installDir -Filter *.exe -ErrorAction SilentlyContinue
              if ($exes.Count -gt 0) {
                # Look for matching executable or take the first one
                $matchedExe = $exes | Where-Object { $_.Name -like "*$($_.DisplayName.Replace(' ', '*'))*" } | Select-Object -First 1
                if (-not $matchedExe) { $matchedExe = $exes[0] }
                if ($matchedExe) {
                  $apps += [PSCustomObject]@{
                    name = $_.DisplayName
                    path = $matchedExe.FullName
                  }
                }
              }
            }
          }
        }

        $apps | ConvertTo-Json
      `;

      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCommand], { shell: false });
      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          console.warn(`[AppManager] PowerShell process exited with code ${code}. Error: ${errorOutput}`);
          return resolve(); // Resolve gracefully to allow standard seed fallback
        }

        try {
          if (output.trim()) {
            const parsed = JSON.parse(output.trim());
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              if (item && item.name && item.path) {
                const nameLower = item.name.toLowerCase().trim();
                // Avoid overwriting standard apps with weird installers
                if (!this.appIndex[nameLower] && fs.existsSync(item.path)) {
                  this.appIndex[nameLower] = item.path;
                }
              }
            }
          }
        } catch (e: any) {
          console.error("[AppManager] JSON parsing of PowerShell app index failed:", e.message);
        }
        resolve();
      });
    });
  }

  /**
   * Intelligently resolves application query and returns launch target or disambiguation list
   */
  public resolveApp(query: string): { matchedName: string; path: string; exact: boolean; matches?: string[] } | null {
    const cleanQuery = query.toLowerCase().trim();

    // 1. Direct exact or custom mapping match
    if (this.appIndex[cleanQuery]) {
      return { matchedName: cleanQuery, path: this.appIndex[cleanQuery], exact: true };
    }

    // 2. Fallback check: Substring search (e.g. "VS Code" matches "Visual Studio Code")
    const matches: Array<{ name: string; path: string }> = [];
    for (const [key, val] of Object.entries(this.appIndex)) {
      if (key.includes(cleanQuery) || cleanQuery.includes(key)) {
        matches.push({ name: key, path: val });
      }
    }

    // If only one match, return it
    if (matches.length === 1) {
      return { matchedName: matches[0].name, path: matches[0].path, exact: true };
    }

    // If multiple matches, trigger disambiguation
    if (matches.length > 1) {
      return {
        matchedName: "",
        path: "",
        exact: false,
        matches: matches.map(m => m.name)
      };
    }

    return null;
  }

  /**
   * Launches the application safely using Multi-Method Execution and Adaptive Learning.
   */
  public async launch(appName: string, targetPath: string): Promise<LaunchResult> {
    const platform = process.platform;
    const isCloudContainer = process.env.K_SERVICE || process.env.K_REVISION || (platform === "linux" && !process.env.DISPLAY);

    console.log(`[AppManager LOG] Request to launch application: "${appName}"`);
    console.log(`[AppManager LOG] Matched app: "${appName}"`);
    console.log(`[AppManager LOG] Target path: "${targetPath}"`);

    const isUrl = targetPath.startsWith("http://") || targetPath.startsWith("https://");
    const isProtocol = targetPath.endsWith(":") || targetPath.includes(":/") || targetPath.startsWith("ms-settings:");
    let isDirectory = false;
    try {
      isDirectory = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
    } catch (_) {}

    if (isCloudContainer) {
      const msg = `Simulated launch of target '${appName}' successfully inside cloud sandbox. Target: ${targetPath}`;
      console.log(`[AppManager LOG] Launch status: Simulated Success. Status details: Nominal`);
      return {
        success: true,
        appName,
        matchedName: appName,
        path: targetPath,
        message: msg
      };
    }

    // Support URLs, protocols, and directory folders
    if (isUrl || isProtocol || isDirectory) {
      return new Promise((resolve) => {
        try {
          console.log(`[AppManager LOG] Spawning system launcher for: "${targetPath}"`);
          let child;
          if (platform === "win32") {
            child = spawn("cmd.exe", ["/c", "start", "", targetPath], { shell: true, detached: true, stdio: "ignore" });
          } else if (platform === "darwin") {
            child = spawn("open", [targetPath], { shell: true, detached: true, stdio: "ignore" });
          } else {
            child = spawn("xdg-open", [targetPath], { shell: true, detached: true, stdio: "ignore" });
          }
          child.unref();
          resolve({
            success: true,
            appName,
            matchedName: appName,
            path: targetPath,
            message: `Successfully opened target "${targetPath}"`
          });
        } catch (err: any) {
          resolve({
            success: false,
            appName,
            matchedName: appName,
            path: targetPath,
            error: "LaunchError",
            message: `Failed to open target: ${err.message}`
          });
        }
      });
    }

    // Lazy load MemoryManager to fetch saved successful strategy and avoid circular import blocks
    let mm: any = null;
    try {
      const { MemoryManager } = require("./research/MemoryManager");
      mm = MemoryManager.getInstance();
    } catch (_) {}

    // Multi-Method Execution strategies
    const strategies = [
      {
        name: "Direct Binary Spawn",
        execute: async () => {
          if (!fs.existsSync(targetPath)) throw new Error(`Path does not exist: ${targetPath}`);
          return new Promise<void>((resolve, reject) => {
            const child = spawn(targetPath, [], { shell: false, detached: true, stdio: "ignore" });
            child.unref();
            child.on("error", reject);
            setTimeout(resolve, 300);
          });
        }
      },
      {
        name: "System Shell Start",
        execute: async () => {
          return new Promise<void>((resolve, reject) => {
            let child;
            if (platform === "win32") {
              child = spawn("cmd.exe", ["/c", "start", "", appName], { shell: true, detached: true, stdio: "ignore" });
            } else if (platform === "darwin") {
              child = spawn("open", ["-a", appName], { shell: true, detached: true, stdio: "ignore" });
            } else {
              child = spawn(appName, [], { shell: true, detached: true, stdio: "ignore" });
            }
            child.unref();
            child.on("error", reject);
            setTimeout(resolve, 300);
          });
        }
      },
      {
        name: "PATH Environment Lookup",
        execute: async () => {
          const paths = (process.env.PATH || "").split(path.delimiter);
          let foundPath = "";
          const exeName = platform === "win32" ? `${appName}.exe` : appName;
          for (const p of paths) {
            const full = path.join(p, exeName);
            try {
              if (fs.existsSync(full)) {
                foundPath = full;
                break;
              }
            } catch (_) {}
          }
          if (!foundPath) throw new Error(`Could not find ${exeName} in system PATH.`);
          return new Promise<void>((resolve, reject) => {
            const child = spawn(foundPath, [], { shell: false, detached: true, stdio: "ignore" });
            child.unref();
            child.on("error", reject);
            setTimeout(resolve, 300);
          });
        }
      },
      {
        name: "Common Installation Directories Probe",
        execute: async () => {
          if (platform !== "win32") throw new Error("Common folder probe is only supported on Windows.");
          const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
          const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
          const localAppData = process.env["LocalAppData"] || "";
          const possiblePaths = [
            path.join(programFiles, appName, `${appName}.exe`),
            path.join(programFilesX86, appName, `${appName}.exe`),
            path.join(localAppData, "Programs", appName, `${appName}.exe`),
          ];
          let found = "";
          for (const p of possiblePaths) {
            try {
              if (fs.existsSync(p)) {
                found = p;
                break;
              }
            } catch (_) {}
          }
          if (!found) throw new Error("Could not locate app in common installation folders.");
          return new Promise<void>((resolve, reject) => {
            const child = spawn(found, [], { shell: false, detached: true, stdio: "ignore" });
            child.unref();
            child.on("error", reject);
            setTimeout(resolve, 300);
          });
        }
      }
    ];

    // Adaptive Learning check: prioritize previously successful launch strategy if registered
    const savedIndex = mm ? mm.getSetting(`success_launch_strategy:${appName.toLowerCase()}`, null) : null;
    let strategyOrder = [...Array(strategies.length).keys()];
    if (savedIndex !== null && typeof savedIndex === "number" && savedIndex >= 0 && savedIndex < strategies.length) {
      console.log(`[AppManager Adaptive Learning] Prioritizing successful Strategy #${savedIndex} (${strategies[savedIndex].name}) based on prior local success.`);
      strategyOrder = [savedIndex, ...strategyOrder.filter(idx => idx !== savedIndex)];
    }

    let lastError: any = null;
    let successfulStrategyIndex = -1;

    for (let i = 0; i < strategyOrder.length; i++) {
      const idx = strategyOrder[i];
      const strategy = strategies[idx];
      console.log(`[AppManager Multi-Method] Attempting Strategy #${idx} (${strategy.name}) for: ${appName}`);
      try {
        await strategy.execute();
        successfulStrategyIndex = idx;
        console.log(`[AppManager Multi-Method] Success using Strategy #${idx} (${strategy.name})`);
        break;
      } catch (err: any) {
        console.warn(`[AppManager Multi-Method] Strategy #${idx} (${strategy.name}) failed: ${err.message}`);
        lastError = err;
      }
    }

    if (successfulStrategyIndex !== -1) {
      // Save successful method (Adaptive Learning - Feature 9)
      if (mm) {
        try {
          mm.saveSetting(`success_launch_strategy:${appName.toLowerCase()}`, successfulStrategyIndex);
        } catch (_) {}
      }
      return {
        success: true,
        appName,
        matchedName: appName,
        path: targetPath,
        message: `Successfully launched application "${appName}" via Multi-Method execution [Strategy #${successfulStrategyIndex}: ${strategies[successfulStrategyIndex].name}]`
      };
    }

    const errMsg = `All ${strategies.length} launch strategies exhausted. Failed to start ${appName}. Last error: ${lastError?.message || "Unknown error"}`;
    console.error(`[AppManager LOG] Launch status: Failed. Error details: ${errMsg}`);
    return {
      success: false,
      appName,
      matchedName: appName,
      path: targetPath,
      error: "AllStrategiesFailed",
      message: errMsg
    };
  }

  /**
   * List all indexed applications for diagnostics / testing
   */
  public getIndexedApps(): Record<string, string> {
    return { ...this.appIndex };
  }
}
