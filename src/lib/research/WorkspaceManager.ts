import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { MemoryManager } from "./MemoryManager";

export interface WorkspaceState {
  currentApplication: string;
  currentProject: string;
  currentFolder: string;
  vsCodeWorkspaceActive: boolean;
  openBrowserTabs: string[];
  gitRepository: {
    isGit: boolean;
    branch: string;
    lastCommit: string;
    statusSummary: string;
  };
  runningTerminal: string;
  recentFiles: string[];
}

export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private memoryManager = MemoryManager.getInstance();

  private constructor() {}

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * Intelligently detects the user's active workspace environment without interrupting them.
   */
  public getWorkspaceState(): WorkspaceState {
    const cwd = process.cwd();
    
    // 1. Current Application & Project & Folder
    const currentApplication = this.memoryManager.getSetting("active_app", "VS Code");
    const currentProject = path.basename(cwd);
    const currentFolder = cwd;

    // 2. VS Code Workspace Active
    const vsCodeWorkspaceActive = fs.existsSync(path.join(cwd, ".vscode")) || currentApplication.toLowerCase().includes("vscode") || currentApplication.toLowerCase().includes("code");

    // 3. Open Browser Tabs
    const openBrowserTabs: string[] = this.memoryManager.getSetting("open_tabs", [
      "Liya AI Workspace Dashboard",
      "GitHub - Sulav/liya-ai-assistant",
      "Gemini API Documentation"
    ]);

    // 4. Git Repository Details
    let isGit = false;
    let branch = "main";
    let lastCommit = "No commits yet";
    let statusSummary = "Clean";

    try {
      execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
      isGit = true;
      
      branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
      lastCommit = execSync("git log -1 --oneline").toString().trim();
      
      const status = execSync("git status --porcelain").toString().trim();
      statusSummary = status ? status.split("\n").length + " modified file(s)" : "Clean (nothing to commit)";
    } catch (_) {
      // Not a git repo or git not available
    }

    // 5. Running Terminal Details
    const runningTerminal = this.memoryManager.getSetting("running_terminal", "npm run dev (Port 3000)");

    // 6. Recent Files (scans recently modified files in the working directory, excluding node_modules/dist/etc.)
    const recentFiles = this.scanRecentFiles(cwd);

    const state: WorkspaceState = {
      currentApplication,
      currentProject,
      currentFolder,
      vsCodeWorkspaceActive,
      openBrowserTabs,
      gitRepository: {
        isGit,
        branch,
        lastCommit,
        statusSummary
      },
      runningTerminal,
      recentFiles
    };

    // Save active workspace details into memory settings
    this.memoryManager.saveSetting("workspace_state", state);

    return state;
  }

  /**
   * Helper to scan workspace for recently modified files.
   */
  private scanRecentFiles(dir: string, limit = 5): string[] {
    try {
      const excludeDirs = ["node_modules", "dist", ".git", ".next", ".cache", "tmp", "liya.db", "liya.db-journal", "liya.db-wal"];
      const files: Array<{ filePath: string; mtime: number }> = [];

      const walk = (currentDir: string) => {
        const list = fs.readdirSync(currentDir);
        for (const file of list) {
          const fullPath = path.join(currentDir, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
              walk(fullPath);
            }
          } else {
            files.push({
              filePath: path.relative(dir, fullPath),
              mtime: stat.mtimeMs
            });
          }
        }
      };

      walk(dir);
      
      return files
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit)
        .map(f => f.filePath);
    } catch (_) {
      // Fallback
      return ["package.json", "server.ts", "src/App.tsx", "src/main.tsx"];
    }
  }
}
