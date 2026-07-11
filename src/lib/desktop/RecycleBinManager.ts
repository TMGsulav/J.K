import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { FileManager } from "../fileManager";

export interface RecycleBinItem {
  name: string;
  originalPath: string;
  size: number;
}

export class RecycleBinManager {
  private static instance: RecycleBinManager;
  private fileManager = FileManager.getInstance();
  private mockRecycleBin: RecycleBinItem[] = [];

  private constructor() {}

  public static getInstance(): RecycleBinManager {
    if (!RecycleBinManager.instance) {
      RecycleBinManager.instance = new RecycleBinManager();
    }
    return RecycleBinManager.instance;
  }

  /**
   * Safely deletes a file by sending it to the OS Recycle Bin.
   */
  public async sendToRecycleBin(inputPath: string): Promise<any> {
    const resolvedPath = this.fileManager.resolveSystemPath(inputPath);
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, message: `File or folder does not exist: "${resolvedPath}"` };
    }

    if (process.platform === "win32") {
      try {
        const psCommand = `
          Add-Type -AssemblyName Microsoft.VisualBasic
          $itemPath = "${resolvedPath.replace(/\\/g, "/")}"
          if (Test-Path $itemPath -PathType Container) {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($itemPath, 'OnlyErrorDialogs', 'SendToRecycleBin')
          } else {
            [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($itemPath, 'OnlyErrorDialogs', 'SendToRecycleBin')
          }
        `;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return { success: true, message: `Successfully moved "${path.basename(resolvedPath)}" to the Recycle Bin.`, resolvedPath };
      } catch (err: any) {
        console.warn("[RecycleBinManager] Native Windows recycle delete failed:", err.message);
      }
    }

    // Sandbox/simulation fallback: move to a virtual hidden trash directory
    try {
      const trashDir = path.join(path.dirname(resolvedPath), ".virtual_trash");
      if (!fs.existsSync(trashDir)) {
        fs.mkdirSync(trashDir, { recursive: true });
      }

      const itemName = path.basename(resolvedPath);
      const stats = fs.statSync(resolvedPath);
      const trashPath = path.join(trashDir, itemName);

      fs.renameSync(resolvedPath, trashPath);
      this.mockRecycleBin.push({
        name: itemName,
        originalPath: resolvedPath,
        size: stats.size
      });

      return {
        success: true,
        message: `Moved "${itemName}" to virtual Recycle Bin.`,
        resolvedPath,
        simulated: true
      };
    } catch (err: any) {
      return { success: false, message: `Failed to move item to Recycle Bin: ${err.message}` };
    }
  }

  /**
   * Restores a deleted item back to its original path.
   */
  public async restoreFromRecycleBin(name: string): Promise<any> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $shell = New-Object -ComObject Shell.Application
          $recycleBin = $shell.Namespace(0xa) # CSIDL_BITBUCKET
          $item = $recycleBin.Items() | Where-Object { $_.Name -like "*${name}*" } | Select-Object -First 1
          if ($item) {
            $item.Verbs() | Where-Object { $_.Name -replace '&' -eq 'Restore' } | ForEach-Object { $_.DoIt() }
            write-output "SUCCESS"
          } else {
            write-output "NOT_FOUND"
          }
        `;
        const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" }).trim();
        if (res === "SUCCESS") {
          return { success: true, message: `Successfully restored "${name}" from the Recycle Bin.` };
        }
        return { success: false, message: `Could not find an item named "${name}" in the Recycle Bin.` };
      } catch (err: any) {
        console.error("[RecycleBinManager] Native restore failed:", err.message);
      }
    }

    // Sandbox Simulation Restore
    const idx = this.mockRecycleBin.findIndex(item => item.name.toLowerCase().includes(name.toLowerCase()));
    if (idx !== -1) {
      const item = this.mockRecycleBin[idx];
      try {
        const trashDir = path.join(path.dirname(item.originalPath), ".virtual_trash");
        const trashPath = path.join(trashDir, item.name);
        
        if (fs.existsSync(trashPath)) {
          fs.renameSync(trashPath, item.originalPath);
        }
        this.mockRecycleBin.splice(idx, 1);
        return { success: true, message: `Successfully restored "${item.name}" from virtual Recycle Bin (simulated).` };
      } catch (err: any) {
        return { success: false, message: `Failed to restore virtual file: ${err.message}` };
      }
    }

    return { success: false, message: `Could not find an item named "${name}" in the Recycle Bin.` };
  }

  /**
   * Empties/clears the OS Recycle Bin.
   */
  public async emptyRecycleBin(): Promise<any> {
    if (process.platform === "win32") {
      try {
        const psCommand = `Clear-RecycleBin -Force -ErrorAction SilentlyContinue`;
        execSync(`powershell.exe -NoProfile -Command "${psCommand}"`);
        return { success: true, message: "Recycle Bin emptied successfully." };
      } catch (err: any) {
        return { success: false, message: `Failed to empty Recycle Bin: ${err.message}` };
      }
    }

    // Sandbox Simulation Empty
    this.mockRecycleBin = [];
    return { success: true, message: "Virtual Recycle Bin cleared successfully." };
  }

  /**
   * Lists all items currently in the Recycle Bin.
   */
  public async listRecycleBinItems(): Promise<RecycleBinItem[]> {
    if (process.platform === "win32") {
      try {
        const psCommand = `
          $shell = New-Object -ComObject Shell.Application
          $recycleBin = $shell.Namespace(0xa)
          $recycleBin.Items() | Select-Object Name, Path, Size | ConvertTo-Json
        `;
        const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
        if (res.trim()) {
          const parsed = JSON.parse(res.trim());
          const items = Array.isArray(parsed) ? parsed : [parsed];
          return items.map(item => ({
            name: item.Name,
            originalPath: item.Path || "Unknown Location",
            size: item.Size || 0
          }));
        }
      } catch (_) {}
    }
    return this.mockRecycleBin;
  }
}
