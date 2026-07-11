import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { FileManager } from "../fileManager";

export interface SearchResultItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  extension?: string;
  modified: Date;
}

export class SearchManager {
  private static instance: SearchManager;
  private fileManager = FileManager.getInstance();

  private constructor() {}

  public static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  /**
   * Search for files/folders matching a query and optional filters.
   */
  public async searchFiles(
    query: string, 
    type: "file" | "folder" | "all" | "document" | "image" | "video" | "download" = "all",
    extension?: string
  ): Promise<SearchResultItem[]> {
    const desktopPath = this.fileManager.resolveSystemPath("Desktop");
    const parentDir = path.dirname(desktopPath); // Usually C:\Users\Username
    
    // Determine the base directories to search in
    let baseSearchDirs = [desktopPath, this.fileManager.resolveSystemPath("Documents")];
    
    if (type === "download") {
      baseSearchDirs = [this.fileManager.resolveSystemPath("Downloads")];
    } else if (type === "image") {
      baseSearchDirs = [this.fileManager.resolveSystemPath("Pictures")];
    } else if (type === "video") {
      baseSearchDirs = [this.fileManager.resolveSystemPath("Videos")];
    } else {
      // Default general search directories
      baseSearchDirs.push(this.fileManager.resolveSystemPath("Downloads"));
    }

    const results: SearchResultItem[] = [];

    // Filter terms based on type categories
    let extFilters: string[] = [];
    if (extension) {
      extFilters.push(extension.toLowerCase());
    } else if (type === "document") {
      extFilters = ["pdf", "docx", "doc", "txt", "xlsx", "pptx", "md", "json"];
    } else if (type === "image") {
      extFilters = ["jpg", "jpeg", "png", "gif", "bmp", "svg"];
    } else if (type === "video") {
      extFilters = ["mp4", "mkv", "avi", "mov", "wmv"];
    }

    // Windows Native PowerShell Fast Search
    if (process.platform === "win32") {
      try {
        for (const baseDir of baseSearchDirs) {
          if (!fs.existsSync(baseDir)) continue;
          
          let filterSnippet = `*${query}*`;
          if (extFilters.length === 1) {
            filterSnippet = `*${query}*.${extFilters[0]}`;
          }

          const psCommand = `
            Get-ChildItem -Path "${baseDir.replace(/\\/g, "/")}" -Filter "${filterSnippet}" -Recurse -ErrorAction SilentlyContinue | Select-Object Name, FullName, Attributes, Length, LastWriteTime | ConvertTo-Json
          `;
          const res = execSync(`powershell.exe -NoProfile -Command "${psCommand}"`, { encoding: "utf-8" });
          if (res.trim()) {
            const parsed = JSON.parse(res.trim());
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
              const isDir = item.Attributes.toLowerCase().includes("directory");
              
              if (type === "folder" && !isDir) continue;
              if (type === "file" && isDir) continue;

              const extension = isDir ? undefined : path.extname(item.FullName).replace(".", "").toLowerCase();
              if (extFilters.length > 1 && !isDir && !extFilters.includes(extension || "")) {
                continue;
              }

              results.push({
                name: item.Name,
                path: item.FullName,
                isDirectory: isDir,
                size: item.Length || 0,
                extension,
                modified: new Date(item.LastWriteTime)
              });
            }
          }
        }
        return results.slice(0, 50); // limit to top 50 matches
      } catch (err) {
        console.warn("[SearchManager] Native search failed, using Node JS fallback", err);
      }
    }

    // Standard JavaScript/Node fallback search
    for (const baseDir of baseSearchDirs) {
      if (!fs.existsSync(baseDir)) continue;
      this.localRecursiveSearch(baseDir, query, type, extFilters, results);
    }

    return results.slice(0, 30);
  }

  /**
   * Retrieves list of recently modified files on Desktop/Documents.
   */
  public async getRecentFiles(limit: number = 10): Promise<SearchResultItem[]> {
    const searchDirs = [
      this.fileManager.resolveSystemPath("Desktop"),
      this.fileManager.resolveSystemPath("Documents"),
      this.fileManager.resolveSystemPath("Downloads")
    ];

    const allItems: SearchResultItem[] = [];

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            allItems.push({
              name: file,
              path: fullPath,
              isDirectory: false,
              size: stats.size,
              extension: path.extname(file).replace(".", "").toLowerCase(),
              modified: stats.mtime
            });
          }
        }
      } catch (_) {}
    }

    return allItems
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())
      .slice(0, limit);
  }

  private localRecursiveSearch(
    dir: string, 
    query: string, 
    type: string, 
    extFilters: string[], 
    accumulator: SearchResultItem[]
  ) {
    if (accumulator.length >= 30) return;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        const isDir = stats.isDirectory();
        const cleanName = item.toLowerCase();
        const matchesQuery = cleanName.includes(query.toLowerCase());

        let matchesFilters = true;
        const extension = isDir ? undefined : path.extname(item).replace(".", "").toLowerCase();
        
        if (type === "folder" && !isDir) matchesFilters = false;
        if (type === "file" && isDir) matchesFilters = false;
        if (extFilters.length > 0 && !isDir && !extFilters.includes(extension || "")) {
          matchesFilters = false;
        }

        if (matchesQuery && matchesFilters) {
          accumulator.push({
            name: item,
            path: fullPath,
            isDirectory: isDir,
            size: stats.size,
            extension,
            modified: stats.mtime
          });
        }

        if (isDir) {
          // Prevent infinite recursion or hitting huge generated directories
          if (item !== "node_modules" && item !== "dist" && !item.startsWith(".")) {
            this.localRecursiveSearch(fullPath, query, type, extFilters, accumulator);
          }
        }
      }
    } catch (_) {}
  }
}
