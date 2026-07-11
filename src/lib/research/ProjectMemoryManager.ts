import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export interface ProjectMemory {
  id: string; // Folder path or name slug
  name: string;
  folder: string;
  language: string;
  framework: string;
  goals: string[];
  completedFeatures: string[];
  pendingTasks: string[];
  knownBugs: string[];
  importantFiles: string[];
  architecture: string;
  recentConversations: string[];
  timestamp: number;
}

export class ProjectMemoryManager {
  private static instance: ProjectMemoryManager;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(process.cwd(), "liya.db");
    this.db = new Database(dbPath);
    this.initializeTable();
  }

  public static getInstance(): ProjectMemoryManager {
    if (!ProjectMemoryManager.instance) {
      ProjectMemoryManager.instance = new ProjectMemoryManager();
    }
    return ProjectMemoryManager.instance;
  }

  private initializeTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        folder TEXT NOT NULL,
        language TEXT,
        framework TEXT,
        goals TEXT, -- JSON array
        completedFeatures TEXT, -- JSON array
        pendingTasks TEXT, -- JSON array
        knownBugs TEXT, -- JSON array
        importantFiles TEXT, -- JSON array
        architecture TEXT,
        recentConversations TEXT, -- JSON array
        timestamp INTEGER NOT NULL
      );
    `);
  }

  public saveProject(project: ProjectMemory) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO Projects (
        id, name, folder, language, framework, goals, completedFeatures, 
        pendingTasks, knownBugs, importantFiles, architecture, recentConversations, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      project.id,
      project.name,
      project.folder,
      project.language,
      project.framework,
      JSON.stringify(project.goals || []),
      JSON.stringify(project.completedFeatures || []),
      JSON.stringify(project.pendingTasks || []),
      JSON.stringify(project.knownBugs || []),
      JSON.stringify(project.importantFiles || []),
      project.architecture || "",
      JSON.stringify(project.recentConversations || []),
      project.timestamp || Date.now()
    );
  }

  public getProject(id: string): ProjectMemory | null {
    const stmt = this.db.prepare("SELECT * FROM Projects WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;

    try {
      return {
        id: row.id,
        name: row.name,
        folder: row.folder,
        language: row.language || "",
        framework: row.framework || "",
        goals: JSON.parse(row.goals || "[]"),
        completedFeatures: JSON.parse(row.completedFeatures || "[]"),
        pendingTasks: JSON.parse(row.pendingTasks || "[]"),
        knownBugs: JSON.parse(row.knownBugs || "[]"),
        importantFiles: JSON.parse(row.importantFiles || "[]"),
        architecture: row.architecture || "",
        recentConversations: JSON.parse(row.recentConversations || "[]"),
        timestamp: row.timestamp
      };
    } catch (e) {
      console.error("[ProjectMemoryManager] Parsing error:", e);
      return null;
    }
  }

  public getAllProjects(): ProjectMemory[] {
    const stmt = this.db.prepare("SELECT * FROM Projects ORDER BY timestamp DESC");
    const rows = stmt.all() as any[];
    return rows.map(row => {
      try {
        return {
          id: row.id,
          name: row.name,
          folder: row.folder,
          language: row.language || "",
          framework: row.framework || "",
          goals: JSON.parse(row.goals || "[]"),
          completedFeatures: JSON.parse(row.completedFeatures || "[]"),
          pendingTasks: JSON.parse(row.pendingTasks || "[]"),
          knownBugs: JSON.parse(row.knownBugs || "[]"),
          importantFiles: JSON.parse(row.importantFiles || "[]"),
          architecture: row.architecture || "",
          recentConversations: JSON.parse(row.recentConversations || "[]"),
          timestamp: row.timestamp
        };
      } catch {
        return {
          id: row.id,
          name: row.name,
          folder: row.folder,
          language: row.language || "",
          framework: row.framework || "",
          goals: [],
          completedFeatures: [],
          pendingTasks: [],
          knownBugs: [],
          importantFiles: [],
          architecture: "",
          recentConversations: [],
          timestamp: row.timestamp
        };
      }
    });
  }

  /**
   * Intelligently scans a local folder path and auto-detects its project name, framework, languages, etc.
   */
  public detectAndLoadProject(folderPath: string): ProjectMemory {
    const resolvedPath = path.resolve(folderPath);
    const slug = path.basename(resolvedPath) || "workspace";
    
    // Check if we already have it in SQLite
    const existing = this.getProject(resolvedPath);
    if (existing) {
      existing.timestamp = Date.now();
      this.saveProject(existing);
      return existing;
    }

    // Otherwise, scan the folder content
    let language = "JavaScript/TypeScript";
    let framework = "React";
    const importantFiles: string[] = [];
    const goals: string[] = ["Build a robust and polished application"];
    const completedFeatures: string[] = ["Project structure set up"];
    const pendingTasks: string[] = ["Implement UI improvements", "Refine user interactions"];
    const knownBugs: string[] = [];
    let architecture = "Component-based architecture";

    try {
      if (fs.existsSync(resolvedPath)) {
        const filesInDir = fs.readdirSync(resolvedPath);
        
        // Language & Framework Detection
        if (filesInDir.includes("package.json")) {
          const pkg = JSON.parse(fs.readFileSync(path.join(resolvedPath, "package.json"), "utf-8"));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          
          if (deps["react"]) {
            framework = "React";
          } else if (deps["vue"]) {
            framework = "Vue";
          } else if (deps["next"]) {
            framework = "Next.js";
          } else {
            framework = "Node.js";
          }

          if (filesInDir.includes("tsconfig.json") || filesInDir.some(f => f.endsWith(".ts") || f.endsWith(".tsx"))) {
            language = "TypeScript";
          } else {
            language = "JavaScript";
          }
        } else if (filesInDir.includes("requirements.txt") || filesInDir.includes("pyproject.toml")) {
          language = "Python";
          framework = "FastAPI/Django/Flask";
        } else if (filesInDir.includes("Cargo.toml")) {
          language = "Rust";
          framework = "Cargo Workspace";
        }

        // Detect important files
        const searchFiles = ["App.tsx", "server.ts", "main.tsx", "package.json", "index.html", "vite.config.ts", "src/App.tsx", "src/main.tsx"];
        for (const file of searchFiles) {
          if (fs.existsSync(path.join(resolvedPath, file))) {
            importantFiles.push(file);
          }
        }
      }
    } catch (e) {
      console.error("[ProjectMemoryManager] Error scanning project folder:", e);
    }

    const newProject: ProjectMemory = {
      id: resolvedPath,
      name: slug,
      folder: resolvedPath,
      language,
      framework,
      goals,
      completedFeatures,
      pendingTasks,
      knownBugs,
      importantFiles,
      architecture,
      recentConversations: [],
      timestamp: Date.now()
    };

    this.saveProject(newProject);
    return newProject;
  }
}
