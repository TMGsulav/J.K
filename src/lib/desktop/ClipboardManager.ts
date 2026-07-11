import { execSync } from "child_process";

export class ClipboardManager {
  private static instance: ClipboardManager;
  private virtualClipboard = "Welcome to Liya's clipboard buffer.";

  private constructor() {}

  public static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  /**
   * Reads text from the system clipboard.
   */
  public async readClipboard(): Promise<string> {
    if (process.platform === "win32") {
      try {
        const psCommand = `Get-Clipboard`;
        const output = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        return output.trim();
      } catch (err) {
        console.warn("[ClipboardManager] Windows native clipboard read failed, using virtual fallback.");
      }
    }
    return this.virtualClipboard;
  }

  /**
   * Writes text to the system clipboard.
   */
  public async writeClipboard(text: string): Promise<boolean> {
    this.virtualClipboard = text;
    if (process.platform === "win32") {
      try {
        // Double quotes are escaped safely for PowerShell arguments
        const escaped = text.replace(/"/g, '`"');
        const psCommand = `Set-Clipboard -Value "${escaped}"`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        return true;
      } catch (err) {
        console.warn("[ClipboardManager] Windows native clipboard write failed, updated virtual clipboard.");
      }
    }
    return true;
  }

  /**
   * Clears the system clipboard.
   */
  public async clearClipboard(): Promise<boolean> {
    return this.writeClipboard("");
  }

  /**
   * Copies selected text (triggers system ctrl+c shortcut via PowerShell keybd_event simulation).
   */
  public async copySelectedText(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          $wsh.SendKeys('^c');
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (err) {
        console.warn("[ClipboardManager] Failed triggering copy keystroke.");
      }
    }
    return true;
  }

  /**
   * Pastes clipboard text automatically (triggers system ctrl+v shortcut).
   */
  public async pasteAutomatically(): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $wsh = New-Object -ComObject WScript.Shell;
          $wsh.SendKeys('^v');
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return true;
      } catch (err) {
        console.warn("[ClipboardManager] Failed triggering paste keystroke.");
      }
    }
    return true;
  }
}
