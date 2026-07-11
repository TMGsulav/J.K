import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface FileOperationResult {
  success: boolean;
  message: string;
  error?: string;
  stack?: string;
  resolvedPath?: string;
  permissionStatus?: {
    isAdmin: boolean;
    canRead: boolean;
    canWrite: boolean;
  };
}

export class FileManager {
  private static instance: FileManager;

  private constructor() {
    this.ensureVirtualDirectories();
  }

  public static getInstance(): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager();
    }
    return FileManager.instance;
  }

  /**
   * Ensure standard virtual directories exist when running in sandbox/non-Windows environments.
   */
  private ensureVirtualDirectories() {
    if (process.platform !== "win32") {
      const folders = ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"];
      for (const f of folders) {
        const dir = path.join(process.cwd(), "virtual_home", f);
        if (!fs.existsSync(dir)) {
          try {
            fs.mkdirSync(dir, { recursive: true });
          } catch (e: any) {
            console.error(`[FileManager] Failed to create virtual directory ${dir}:`, e.message);
          }
        }
      }
    }
  }

  /**
   * Intelligently resolves standard directories (Desktop, Documents, etc.) or absolute paths.
   */
  public resolveSystemPath(inputPath: string): string {
    if (!inputPath) return process.cwd();
    
    const norm = inputPath.replace(/\\/g, "/").trim();
    const parts = norm.split("/");
    const firstToken = parts[0].toLowerCase();

    // Determine the user's home profile directory
    const userProfile = process.env.USERPROFILE || process.env.HOME || process.cwd();

    let resolvedBase = "";
    switch (firstToken) {
      case "desktop":
        resolvedBase = process.platform === "win32" ? path.join(userProfile, "Desktop") : path.join(process.cwd(), "virtual_home", "Desktop");
        break;
      case "documents":
        resolvedBase = process.platform === "win32" ? path.join(userProfile, "Documents") : path.join(process.cwd(), "virtual_home", "Documents");
        break;
      case "downloads":
        resolvedBase = process.platform === "win32" ? path.join(userProfile, "Downloads") : path.join(process.cwd(), "virtual_home", "Downloads");
        break;
      case "pictures":
        resolvedBase = process.platform === "win32" ? path.join(userProfile, "Pictures") : path.join(process.cwd(), "virtual_home", "Pictures");
        break;
      case "videos":
        resolvedBase = process.platform === "win32" ? path.join(userProfile, "Videos") : path.join(process.cwd(), "virtual_home", "Videos");
        break;
      case "music":
        resolvedBase = process.platform === "win32" ? path.join(userProfile, "Music") : path.join(process.cwd(), "virtual_home", "Music");
        break;
      default:
        if (path.isAbsolute(inputPath)) {
          return path.normalize(inputPath);
        }
        return path.resolve(process.cwd(), inputPath);
    }

    const remainingSubpath = parts.slice(1).join("/");
    return remainingSubpath ? path.join(resolvedBase, remainingSubpath) : resolvedBase;
  }

  /**
   * Fast, reliable check for administrative privileges on Windows.
   */
  public checkAdminPrivileges(): boolean {
    if (process.platform !== "win32") return false;
    try {
      // Accessing a system config directory requires admin privileges on Windows
      fs.accessSync("C:\\Windows\\system32\\config\\RegBack", fs.constants.R_OK);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Check read and write permissions on a specific path.
   */
  public getPermissionStatus(filePath: string) {
    const isAdmin = this.checkAdminPrivileges();
    let canRead = false;
    let canWrite = false;

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      canRead = true;
    } catch (_) {}

    try {
      fs.accessSync(filePath, fs.constants.W_OK);
      canWrite = true;
    } catch (_) {}

    // If file doesn't exist, check parent folder write status
    if (!fs.existsSync(filePath)) {
      try {
        fs.accessSync(path.dirname(filePath), fs.constants.W_OK);
        canWrite = true;
        canRead = true; // folder is accessible
      } catch (_) {}
    }

    return { isAdmin, canRead, canWrite };
  }

  /**
   * Logs a comprehensive diagnostic of failed filesystem operations to the console.
   */
  private logFailure(action: string, inputPath: string, resolvedPath: string, error: any) {
    const permStatus = this.getPermissionStatus(resolvedPath);
    console.error(`❌ [FileManager Failure Diagnostics]
• Requested Action: ${action}
• Input Path: ${inputPath}
• Resolved Path: ${resolvedPath}
• Permission Status: Read=${permStatus.canRead}, Write=${permStatus.canWrite}, WindowsAdmin=${permStatus.isAdmin}
• Error Message: ${error.message || error}
• Error Code: ${error.code || "N/A"}
• Exception Stack: ${error.stack || "No stack trace available"}`);
  }

  // ==============================
  // CORE OPERATIONS
  // ==============================

  public async createFile(inputPath: string, content: string = ""): Promise<FileOperationResult> {
    const resolvedPath = this.resolveSystemPath(inputPath);
    try {
      const parentDir = path.dirname(resolvedPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedPath, content, "utf-8");
      return {
        success: true,
        message: `Successfully created file: "${path.basename(resolvedPath)}"`,
        resolvedPath
      };
    } catch (err: any) {
      this.logFailure("Create File", inputPath, resolvedPath, err);
      return {
        success: false,
        message: `Failed to create file: ${err.message}`,
        error: err.code || "WriteError",
        stack: err.stack,
        resolvedPath,
        permissionStatus: this.getPermissionStatus(resolvedPath)
      };
    }
  }

  public async createFolder(inputPath: string): Promise<FileOperationResult> {
    const resolvedPath = this.resolveSystemPath(inputPath);
    try {
      if (fs.existsSync(resolvedPath)) {
        return {
          success: true,
          message: `Folder already exists: "${resolvedPath}"`,
          resolvedPath
        };
      }
      fs.mkdirSync(resolvedPath, { recursive: true });
      return {
        success: true,
        message: `Successfully created folder: "${path.basename(resolvedPath)}"`,
        resolvedPath
      };
    } catch (err: any) {
      this.logFailure("Create Folder", inputPath, resolvedPath, err);
      return {
        success: false,
        message: `Failed to create folder: ${err.message}`,
        error: err.code || "MkdirError",
        stack: err.stack,
        resolvedPath,
        permissionStatus: this.getPermissionStatus(resolvedPath)
      };
    }
  }

  public async rename(inputPath: string, newName: string): Promise<FileOperationResult> {
    const resolvedPath = this.resolveSystemPath(inputPath);
    try {
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Target path does not exist: "${resolvedPath}"`);
      }
      const parentDir = path.dirname(resolvedPath);
      const newResolvedPath = path.join(parentDir, newName);
      fs.renameSync(resolvedPath, newResolvedPath);
      return {
        success: true,
        message: `Successfully renamed to "${newName}"`,
        resolvedPath: newResolvedPath
      };
    } catch (err: any) {
      this.logFailure("Rename", inputPath, resolvedPath, err);
      return {
        success: false,
        message: `Failed to rename: ${err.message}`,
        error: err.code || "RenameError",
        stack: err.stack,
        resolvedPath,
        permissionStatus: this.getPermissionStatus(resolvedPath)
      };
    }
  }

  /**
   * Helper to determine if a path targets a critical system, OS, or user directory.
   */
  private isPathCritical(resolvedPath: string): boolean {
    const p = path.normalize(resolvedPath).toLowerCase();
    const cleanPath = p.replace(/[\\/]+$/, "");
    
    // Check for drive roots (Windows roots e.g. "c:", "d:" or Linux "/")
    if (cleanPath.length <= 3 && (cleanPath.endsWith(":") || cleanPath === "" || cleanPath === "/")) {
      return true;
    }
    
    // Critical directories on Windows and Unix/Linux
    const criticalSubstrings = [
      "c:\\windows",
      "c:\\program files",
      "c:\\program files (x86)",
      "c:\\users\\all users",
      "/usr",
      "/var",
      "/etc",
      "/boot",
      "/sys",
      "/proc",
      "/lib",
      "/bin"
    ];

    if (criticalSubstrings.includes(cleanPath)) {
      return true;
    }

    // Check if it is a main system directory root itself (e.g. C:\Users\Username\Documents, etc.)
    const systemDirs = [
      this.resolveSystemPath("Desktop").toLowerCase().replace(/[\\/]+$/, ""),
      this.resolveSystemPath("Documents").toLowerCase().replace(/[\\/]+$/, ""),
      this.resolveSystemPath("Downloads").toLowerCase().replace(/[\\/]+$/, ""),
      this.resolveSystemPath("Pictures").toLowerCase().replace(/[\\/]+$/, ""),
      this.resolveSystemPath("Music").toLowerCase().replace(/[\\/]+$/, ""),
      this.resolveSystemPath("Videos").toLowerCase().replace(/[\\/]+$/, ""),
      path.dirname(this.resolveSystemPath("Desktop")).toLowerCase().replace(/[\\/]+$/, "") // e.g. C:\Users\Username itself!
    ];

    if (systemDirs.includes(cleanPath)) {
      return true;
    }

    return false;
  }

  public async delete(inputPath: string): Promise<FileOperationResult> {
    const resolvedPath = this.resolveSystemPath(inputPath);
    try {
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Path does not exist: "${resolvedPath}"`);
      }

      if (this.isPathCritical(resolvedPath)) {
        throw new Error(`Permission Denied: Deleting critical system/profile path is strictly forbidden for security reasons: "${resolvedPath}"`);
      }

      const stats = fs.statSync(resolvedPath);
      if (stats.isDirectory()) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(resolvedPath);
      }
      return {
        success: true,
        message: `Successfully deleted: "${path.basename(resolvedPath)}"`,
        resolvedPath
      };
    } catch (err: any) {
      this.logFailure("Delete", inputPath, resolvedPath, err);
      return {
        success: false,
        message: `Failed to delete: ${err.message}`,
        error: err.code || "DeleteError",
        stack: err.stack,
        resolvedPath,
        permissionStatus: this.getPermissionStatus(resolvedPath)
      };
    }
  }

  public async copy(sourceInput: string, destInput: string): Promise<FileOperationResult> {
    const srcResolved = this.resolveSystemPath(sourceInput);
    const destResolved = this.resolveSystemPath(destInput);
    try {
      if (!fs.existsSync(srcResolved)) {
        throw new Error(`Source path does not exist: "${srcResolved}"`);
      }
      const parentDir = path.dirname(destResolved);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const stats = fs.statSync(srcResolved);
      if (stats.isDirectory()) {
        fs.cpSync(srcResolved, destResolved, { recursive: true });
      } else {
        fs.copyFileSync(srcResolved, destResolved);
      }
      return {
        success: true,
        message: `Successfully copied from "${path.basename(srcResolved)}" to "${path.basename(destResolved)}"`,
        resolvedPath: destResolved
      };
    } catch (err: any) {
      this.logFailure("Copy", sourceInput, srcResolved, err);
      return {
        success: false,
        message: `Failed to copy: ${err.message}`,
        error: err.code || "CopyError",
        stack: err.stack,
        resolvedPath: srcResolved,
        permissionStatus: this.getPermissionStatus(srcResolved)
      };
    }
  }

  public async move(sourceInput: string, destInput: string): Promise<FileOperationResult> {
    const srcResolved = this.resolveSystemPath(sourceInput);
    const destResolved = this.resolveSystemPath(destInput);
    try {
      if (!fs.existsSync(srcResolved)) {
        throw new Error(`Source path does not exist: "${srcResolved}"`);
      }
      const parentDir = path.dirname(destResolved);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.renameSync(srcResolved, destResolved);
      return {
        success: true,
        message: `Successfully moved to "${destResolved}"`,
        resolvedPath: destResolved
      };
    } catch (err: any) {
      this.logFailure("Move", sourceInput, srcResolved, err);
      return {
        success: false,
        message: `Failed to move: ${err.message}`,
        error: err.code || "MoveError",
        stack: err.stack,
        resolvedPath: srcResolved,
        permissionStatus: this.getPermissionStatus(srcResolved)
      };
    }
  }

  public async read(inputPath: string): Promise<FileOperationResult & { content?: string }> {
    const resolvedPath = this.resolveSystemPath(inputPath);
    try {
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File does not exist: "${resolvedPath}"`);
      }
      const content = fs.readFileSync(resolvedPath, "utf-8");
      return {
        success: true,
        message: `Successfully read file: "${path.basename(resolvedPath)}"`,
        content,
        resolvedPath
      };
    } catch (err: any) {
      this.logFailure("Read File", inputPath, resolvedPath, err);
      return {
        success: false,
        message: `Failed to read file: ${err.message}`,
        error: err.code || "ReadError",
        stack: err.stack,
        resolvedPath,
        permissionStatus: this.getPermissionStatus(resolvedPath)
      };
    }
  }

  public async write(inputPath: string, content: string): Promise<FileOperationResult> {
    return this.createFile(inputPath, content);
  }

  public async search(
    query: string,
    searchType: string = "all",
    extension?: string
  ): Promise<FileOperationResult & { results?: Array<{ name: string; path: string; isDirectory: boolean }> }> {
    // Search default base folders: Desktop, Documents, Downloads
    const foldersToSearch = ["Desktop", "Documents", "Downloads"];
    const results: Array<{ name: string; path: string; isDirectory: boolean }> = [];
    const cleanQuery = query.toLowerCase().trim();

    try {
      for (const folder of foldersToSearch) {
        const baseDir = this.resolveSystemPath(folder);
        if (!fs.existsSync(baseDir)) continue;

        const files = fs.readdirSync(baseDir);
        for (const file of files) {
          const fullPath = path.join(baseDir, file);
          const isMatch = file.toLowerCase().includes(cleanQuery);
          if (isMatch) {
            let isDir = false;
            try {
              isDir = fs.statSync(fullPath).isDirectory();
            } catch (_) {}

            if (searchType === "folders" && !isDir) continue;
            if (searchType === "files" && isDir) continue;

            if (extension) {
              const fileExt = path.extname(file).replace(".", "").toLowerCase();
              if (fileExt !== extension.replace(".", "").toLowerCase()) {
                continue;
              }
            }

            results.push({
              name: file,
              path: fullPath,
              isDirectory: isDir
            });
          }
        }
      }

      return {
        success: true,
        message: `Found ${results.length} search results for "${query}"`,
        results
      };
    } catch (err: any) {
      // Log search failure but return an empty list gracefully
      this.logFailure("Search Files", query, "Search Bases", err);
      return {
        success: false,
        message: `File search error: ${err.message}`,
        results: [],
        error: err.code || "SearchError",
        stack: err.stack
      };
    }
  }
}
