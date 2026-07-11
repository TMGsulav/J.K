import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { ProjectMemoryManager } from "./ProjectMemoryManager";

export interface LogEntry {
  id: string;
  timestamp: string;
  sender: "user" | "liya" | "system";
  text: string;
  isToolCall?: boolean;
  toolDetails?: {
    name: string;
    args: any;
    status: "pending" | "success" | "error";
    result?: any;
  };
}

export interface SavedSession {
  id: string;
  timestamp: string;
  title: string;
  logs: LogEntry[];
  tags?: string[];
  summary?: string;
  keywords?: string[];
}

export class MemoryManager {
  private static instance: MemoryManager;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(process.cwd(), "liya.db");
    console.log(`[MemoryManager] Initializing SQLite Database at: ${dbPath}`);
    this.db = new Database(dbPath);
    
    // Enable WAL mode for high-concurrency performance and reliability
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.initializeTables();
    this.migrateOldJsonMemory();
    this.seedCreatorProfile();
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        tags TEXT, -- JSON array of tags
        timestamp INTEGER NOT NULL,
        summary TEXT,
        keywords TEXT -- JSON array of keywords
      );

      CREATE TABLE IF NOT EXISTS Messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        sender TEXT NOT NULL, -- 'user', 'liya', 'system'
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        isToolCall INTEGER DEFAULT 0,
        toolDetails TEXT, -- JSON string of toolDetails if any
        FOREIGN KEY(conversationId) REFERENCES Conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS LongTermMemory (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL, -- 'profile', 'project', 'goal', 'preference', 'preference_language', etc.
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        importance TEXT DEFAULT 'Low', -- 'High' or 'Low'
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'completed'
        notes TEXT,
        project TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ToolHistory (
        id TEXT PRIMARY KEY,
        conversationId TEXT,
        toolName TEXT NOT NULL,
        args TEXT, -- JSON string
        status TEXT NOT NULL, -- 'pending', 'success', 'error'
        result TEXT, -- JSON string
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS SearchHistory (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        resultsCount INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS EmotionHistory (
        id TEXT PRIMARY KEY,
        emotion TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Aliases (
        id TEXT PRIMARY KEY,
        shortcut TEXT UNIQUE NOT NULL,
        target TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL -- Raw text or JSON
      );

      CREATE TABLE IF NOT EXISTS FactualQACache (
        query TEXT PRIMARY KEY,
        answer TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sources TEXT, -- JSON string array
        provider TEXT -- 'duckduckgo', 'tavily', 'gemini'
      );
    `);
    console.log("[MemoryManager] SQLite tables verified and ready.");
  }

  /**
   * Safe migration from diya_memory.json / liya_memory.json / lavi_memory.json to preserve user files/data
   */
  private migrateOldJsonMemory() {
    const memoryPath = path.join(process.cwd(), "liya_memory.json");
    if (!fs.existsSync(memoryPath)) {
      return;
    }

    try {
      console.log("[MemoryManager] Existing liya_memory.json detected. Migrating to SQLite...");
      const data = fs.readFileSync(memoryPath, "utf-8");
      const memory = JSON.parse(data);

      const now = Date.now();

      // Migration wrapper with a database transaction
      const insertLTM = this.db.prepare(`
        INSERT OR REPLACE INTO LongTermMemory (id, category, key, value, importance, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      this.db.transaction(() => {
        // Migrate User Profile
        if (memory.userProfile) {
          for (const [k, v] of Object.entries(memory.userProfile)) {
            if (v) {
              const strVal = typeof v === "object" ? JSON.stringify(v) : String(v);
              insertLTM.run(`profile_${k}`, "profile", k, strVal, "High", now);
            }
          }
        }

        // Migrate Long-Term Memory Fields
        if (memory.longTermMemory) {
          const ltm = memory.longTermMemory;
          if (Array.isArray(ltm.favoriteLanguages) && ltm.favoriteLanguages.length > 0) {
            insertLTM.run("pref_lang", "preference", "favoriteLanguages", JSON.stringify(ltm.favoriteLanguages), "High", now);
          }
          if (ltm.preferredCodingStyle) {
            insertLTM.run("pref_style", "preference", "preferredCodingStyle", ltm.preferredCodingStyle, "High", now);
          }
          if (Array.isArray(ltm.interests) && ltm.interests.length > 0) {
            insertLTM.run("pref_interests", "preference", "interests", JSON.stringify(ltm.interests), "Low", now);
          }
          if (Array.isArray(ltm.objectives) && ltm.objectives.length > 0) {
            insertLTM.run("pref_objectives", "goal", "objectives", JSON.stringify(ltm.objectives), "High", now);
          }
          if (Array.isArray(ltm.currentProjects)) {
            ltm.currentProjects.forEach((proj: any, idx: number) => {
              if (proj && proj.name) {
                insertLTM.run(`proj_${idx}`, "project", `project_${proj.name}`, JSON.stringify(proj), "High", now);
              }
            });
          }
        }

        // Migrate Knowledge Memory
        if (memory.knowledgeMemory) {
          for (const [k, v] of Object.entries(memory.knowledgeMemory)) {
            if (v) {
              insertLTM.run(`know_${k}`, "knowledge", k, String(v), "High", now);
            }
          }
        }

        // Migrate Semantic Memory
        if (memory.semanticMemory) {
          const sem = memory.semanticMemory;
          if (Array.isArray(sem.strengths) && sem.strengths.length > 0) {
            insertLTM.run("sem_strengths", "semantic", "strengths", JSON.stringify(sem.strengths), "High", now);
          }
          if (Array.isArray(sem.weaknesses) && sem.weaknesses.length > 0) {
            insertLTM.run("sem_weaknesses", "semantic", "weaknesses", JSON.stringify(sem.weaknesses), "High", now);
          }
          if (Array.isArray(sem.habits) && sem.habits.length > 0) {
            insertLTM.run("sem_habits", "semantic", "habits", JSON.stringify(sem.habits), "Low", now);
          }
        }

        // Migrate episodic memory to old conversations or episodic logs
        if (Array.isArray(memory.episodicMemory)) {
          memory.episodicMemory.forEach((ep: any, idx: number) => {
            if (ep && ep.event) {
              const epId = `episodic_legacy_${idx}`;
              // Store as high-importance moments
              insertLTM.run(epId, "episodic", `moment_${idx}`, ep.event, "High", ep.date ? new Date(ep.date).getTime() : now);
            }
          });
        }
      })();

      // Rename the file to .bak to avoid re-migration next time
      fs.renameSync(memoryPath, `${memoryPath}.bak`);
      console.log("[MemoryManager] JSON Memory migrated to SQLite database successfully. Backed up old file.");
    } catch (err) {
      console.error("[MemoryManager] Error migrating old JSON memory:", err);
    }
  }

  /**
   * Seeds default creator profile details permanently in the SQLite database.
   * Uses INSERT OR IGNORE to never overwrite these values if they already exist.
   */
  private seedCreatorProfile() {
    try {
      const now = Date.now();
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO LongTermMemory (id, category, key, value, importance, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Seed permanent creator profile facts
      insertStmt.run("creator_name", "profile", "Creator Name", "Sulav", "High", now);
      insertStmt.run("project_name", "profile", "Project Name", "Liya AI", "High", now);
      insertStmt.run("purpose", "profile", "Purpose", "A personal offline-first/hybrid desktop AI assistant project.", "High", now);
      insertStmt.run("preferred_assistant_name", "profile", "Preferred Assistant Name", "Liya", "High", now);
      insertStmt.run("core_project_goals", "profile", "Core Project Goals", "Become a robust, secure, privacy-respecting, Jarvis-like productivity and desktop automation assistant.", "High", now);
      
      insertStmt.run("creator_status", "profile", "Creator Status", "Student, passionate about programming and artificial intelligence.", "High", now);
      insertStmt.run("creator_interests", "profile", "Creator Interests", "Python, web development, building desktop AI assistants, automation, and gaming.", "High", now);
      
      console.log("[MemoryManager] Seeding of persistent Creator Profile verified.");
    } catch (err: any) {
      console.error("[MemoryManager] Error seeding Creator Profile:", err.message);
    }
  }

  // ==========================================
  // 1. Working Memory (Current session details)
  // ==========================================
  public saveSetting(key: string, value: any) {
    const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
    const stmt = this.db.prepare("INSERT OR REPLACE INTO Settings (key, value) VALUES (?, ?)");
    stmt.run(key, serialized);
  }

  public getSetting(key: string, defaultValue: any = null): any {
    const stmt = this.db.prepare("SELECT value FROM Settings WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  }

  // ==========================================
  // 2. Episodic Memory (Conversations / Messages)
  // ==========================================
  public createConversation(id: string, title: string, tags: string[] = [], keywords: string[] = []) {
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split("T")[0];
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO Conversations (id, title, date, tags, timestamp, summary, keywords)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, dateStr, JSON.stringify(tags), timestamp, "", JSON.stringify(keywords));
  }

  public updateConversationSummary(id: string, summary: string, keywords: string[] = []) {
    const stmt = this.db.prepare(`
      UPDATE Conversations
      SET summary = ?, keywords = ?
      WHERE id = ?
    `);
    stmt.run(summary, JSON.stringify(keywords), id);
  }

  public saveMessage(messageId: string, conversationId: string, sender: "user" | "liya" | "system", text: string, isToolCall = false, toolDetails?: any) {
    // Ensure conversation exists
    const checkStmt = this.db.prepare("SELECT id FROM Conversations WHERE id = ?");
    if (!checkStmt.get(conversationId)) {
      this.createConversation(conversationId, text.substring(0, 40) || "New Active Conversation");
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO Messages (id, conversationId, sender, text, timestamp, isToolCall, toolDetails)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      messageId,
      conversationId,
      sender,
      text,
      Date.now(),
      isToolCall ? 1 : 0,
      toolDetails ? JSON.stringify(toolDetails) : null
    );
  }

  public getConversation(id: string): SavedSession | null {
    const convStmt = this.db.prepare("SELECT * FROM Conversations WHERE id = ?");
    const conv = convStmt.get(id) as any;
    if (!conv) return null;

    const msgStmt = this.db.prepare("SELECT * FROM Messages WHERE conversationId = ? ORDER BY timestamp ASC");
    const rows = msgStmt.all(id) as any[];

    const logs: LogEntry[] = rows.map((r) => ({
      id: r.id,
      sender: r.sender,
      text: r.text,
      timestamp: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      isToolCall: r.isToolCall === 1,
      toolDetails: r.toolDetails ? JSON.parse(r.toolDetails) : undefined
    }));

    return {
      id: conv.id,
      title: conv.title,
      timestamp: new Date(conv.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) + " " + new Date(conv.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      logs,
      tags: conv.tags ? JSON.parse(conv.tags) : [],
      summary: conv.summary || "",
      keywords: conv.keywords ? JSON.parse(conv.keywords) : []
    };
  }

  public getAllConversations(): SavedSession[] {
    const convs = this.db.prepare("SELECT * FROM Conversations ORDER BY timestamp DESC").all() as any[];
    return convs.map((conv) => {
      const msgStmt = this.db.prepare("SELECT * FROM Messages WHERE conversationId = ? ORDER BY timestamp ASC");
      const rows = msgStmt.all(conv.id) as any[];

      const logs: LogEntry[] = rows.map((r) => ({
        id: r.id,
        sender: r.sender,
        text: r.text,
        timestamp: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        isToolCall: r.isToolCall === 1,
        toolDetails: r.toolDetails ? JSON.parse(r.toolDetails) : undefined
      }));

      return {
        id: conv.id,
        title: conv.title,
        timestamp: new Date(conv.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) + " " + new Date(conv.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        logs,
        tags: conv.tags ? JSON.parse(conv.tags) : [],
        summary: conv.summary || "",
        keywords: conv.keywords ? JSON.parse(conv.keywords) : []
      };
    });
  }

  public deleteConversation(id: string) {
    const stmt = this.db.prepare("DELETE FROM Conversations WHERE id = ?");
    stmt.run(id);
  }

  public getRecentMessages(limit: number = 5, conversationId?: string | null): Array<{ role: "user" | "model"; text: string; sender: "user" | "liya" | "system" }> {
    try {
      let convId = conversationId;
      if (!convId) {
        convId = this.getSetting("current_conversation_id");
      }
      const query = convId 
        ? "SELECT sender, text FROM Messages WHERE conversationId = ? ORDER BY timestamp DESC LIMIT ?"
        : "SELECT sender, text FROM Messages ORDER BY timestamp DESC LIMIT ?";
      const stmt = this.db.prepare(query);
      const rows = convId ? stmt.all(convId, limit) as any[] : stmt.all(limit) as any[];
      return rows.reverse().map((r) => ({
        role: r.sender === "user" ? "user" : "model",
        sender: r.sender || "liya",
        text: r.text
      }));
    } catch (e) {
      console.error("[MemoryManager] Error fetching recent messages:", e);
      return [];
    }
  }

  // ==========================================
  // 3. Long-Term Memory (LTM System)
  // ==========================================
  public updateLongTermMemory(category: string, key: string, value: string, importance: "High" | "Low" = "Low") {
    const id = `${category}_${key.toLowerCase().replace(/\s+/g, "_")}`;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO LongTermMemory (id, category, key, value, importance, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, category, key, value, importance, Date.now());
  }

  public getLongTermMemory(key: string): any {
    const stmt = this.db.prepare("SELECT * FROM LongTermMemory WHERE key = ?");
    return stmt.get(key);
  }

  public getAllLongTermMemories(): any[] {
    return this.db.prepare("SELECT * FROM LongTermMemory ORDER BY timestamp DESC").all();
  }

  public deleteLongTermMemory(key: string) {
    const stmt = this.db.prepare("DELETE FROM LongTermMemory WHERE key = ?");
    stmt.run(key);
  }

  public deleteLongTermMemoryById(id: string) {
    const stmt = this.db.prepare("DELETE FROM LongTermMemory WHERE id = ?");
    stmt.run(id);
  }

  // ==========================================
  // 4. Task Memory
  // ==========================================
  public saveTask(id: string, title: string, status: "pending" | "completed" = "pending", notes = "", project = "") {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO Tasks (id, title, status, notes, project, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, title, status, notes, project, Date.now());
  }

  public getPendingTasks(): any[] {
    return this.db.prepare("SELECT * FROM Tasks WHERE status = 'pending' ORDER BY timestamp DESC").all();
  }

  public getAllTasks(): any[] {
    return this.db.prepare("SELECT * FROM Tasks ORDER BY timestamp DESC").all();
  }

  public deleteTask(id: string) {
    const stmt = this.db.prepare("DELETE FROM Tasks WHERE id = ?");
    stmt.run(id);
  }

  // ==========================================
  // 5. Tool & Search & Emotion & Aliases
  // ==========================================
  public saveToolHistory(id: string, conversationId: string | null, toolName: string, args: any, status: string, result?: any) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ToolHistory (id, conversationId, toolName, args, status, result, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      conversationId,
      toolName,
      JSON.stringify(args),
      status,
      result ? JSON.stringify(result) : null,
      Date.now()
    );
  }

  public saveSearchQuery(query: string, resultsCount = 0) {
    const id = Math.random().toString(36).substring(2, 9);
    const stmt = this.db.prepare(`
      INSERT INTO SearchHistory (id, query, timestamp, resultsCount)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, query, Date.now(), resultsCount);
  }

  public saveEmotionState(emotion: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const stmt = this.db.prepare(`
      INSERT INTO EmotionHistory (id, emotion, timestamp)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, emotion, Date.now());
    this.saveSetting("current_emotion", emotion);
  }

  public saveAlias(shortcut: string, target: string) {
    const id = Math.random().toString(36).substring(2, 9);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO Aliases (id, shortcut, target, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, shortcut, target, Date.now());
  }

  public getAliases(): any[] {
    return this.db.prepare("SELECT * FROM Aliases ORDER BY shortcut ASC").all();
  }

  public deleteAlias(shortcut: string) {
    const stmt = this.db.prepare("DELETE FROM Aliases WHERE shortcut = ?");
    stmt.run(shortcut);
  }

  // ==========================================
  // 6. Natural Language Search & Memory Retrieval Pipeline
  // ==========================================
  public searchConversations(searchQuery: string): SavedSession[] {
    const normalized = `%${searchQuery.toLowerCase()}%`;
    
    // Find conversations whose title, tags, keywords, summary, OR message texts contain the search query
    const convRows = this.db.prepare(`
      SELECT DISTINCT c.* FROM Conversations c
      LEFT JOIN Messages m ON c.id = m.conversationId
      WHERE c.title LIKE ?
         OR c.summary LIKE ?
         OR c.tags LIKE ?
         OR c.keywords LIKE ?
         OR m.text LIKE ?
      ORDER BY c.timestamp DESC
    `).all(normalized, normalized, normalized, normalized, normalized) as any[];

    return convRows.map((conv) => {
      const msgStmt = this.db.prepare("SELECT * FROM Messages WHERE conversationId = ? ORDER BY timestamp ASC");
      const rows = msgStmt.all(conv.id) as any[];

      const logs: LogEntry[] = rows.map((r) => ({
        id: r.id,
        sender: r.sender,
        text: r.text,
        timestamp: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        isToolCall: r.isToolCall === 1,
        toolDetails: r.toolDetails ? JSON.parse(r.toolDetails) : undefined
      }));

      return {
        id: conv.id,
        title: conv.title,
        timestamp: new Date(conv.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }) + " " + new Date(conv.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        logs,
        tags: conv.tags ? JSON.parse(conv.tags) : [],
        summary: conv.summary || "",
        keywords: conv.keywords ? JSON.parse(conv.keywords) : []
      };
    });
  }

  /**
   * Pipeline Context builder:
   * Retrieves LTM, pending tasks, relevant search background, and last dialogue contexts.
   */
  public buildPipelineContext(currentConversationId: string | null): string {
    const ltm = this.getAllLongTermMemories();
    const tasks = this.getPendingTasks();
    const currentEmotion = this.getSetting("current_emotion", "neutral");
    const activeApp = this.getSetting("active_app", "None");
    const openFiles = this.getSetting("open_files", []);
    const openTabs = this.getSetting("open_tabs", []);

    let context = `# Liya's Advanced Human-Like Memory System (SQLite-Backed Context)\n`;
    
    // 1. Working Memory
    context += `\n## 1. Active Working Memory:\n`;
    context += `- Current Emotion State: ${currentEmotion}\n`;
    context += `- Foreground Application: ${activeApp}\n`;
    context += `- Currently Open Files: ${JSON.stringify(openFiles)}\n`;
    context += `- Open Web Browser Tabs: ${JSON.stringify(openTabs)}\n`;

    // 2. Long-Term Memory
    context += `\n## 2. Long-Term Memory (Factual & Preference Store):\n`;
    if (ltm.length === 0) {
      context += `- No records in permanent Long-Term Memory yet.\n`;
    } else {
      // Group by category to make it extremely organized and token-optimized
      const grouped: { [cat: string]: any[] } = {};
      ltm.forEach((m) => {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
      });

      for (const [cat, items] of Object.entries(grouped)) {
        context += `### ${cat.toUpperCase()}:\n`;
        items.forEach((item) => {
          context += `- [Importance: ${item.importance}] ${item.key}: ${item.value}\n`;
        });
      }
    }

    // 3. Task Memory
    context += `\n## 3. Pending Task Memory:\n`;
    if (tasks.length === 0) {
      context += `- No pending tasks currently active.\n`;
    } else {
      tasks.forEach((t) => {
        context += `- [ ] ${t.title}${t.project ? ` (Project: ${t.project})` : ""}${t.notes ? ` - Note: ${t.notes}` : ""}\n`;
      });
    }

    // 4. Past Conversation Semantic Summaries
    context += `\n## 4. Semantic Episodic Summaries of Past Discussions:\n`;
    const pastConvs = this.getAllConversations().filter(c => c.id !== currentConversationId);
    if (pastConvs.length === 0) {
      context += `- No past sessions recorded yet.\n`;
    } else {
      pastConvs.slice(0, 5).forEach((c) => {
        if (c.summary) {
          context += `- [Session: ${c.title} on ${c.timestamp}] Summary: ${c.summary}\n`;
        } else {
          // Fallback to title + list of tags
          context += `- [Session: ${c.title} on ${c.timestamp}] Tags: ${JSON.stringify(c.tags || [])}\n`;
        }
      });
    }

    // 5. Persistent Project Memory
    try {
      const pmm = ProjectMemoryManager.getInstance();
      const activeProjId = this.getSetting("active_project_id", process.cwd());
      const proj = pmm.getProject(activeProjId) || pmm.detectAndLoadProject(activeProjId);
      if (proj) {
        context += `\n## 5. Persistent Project Memory (${proj.name}):\n`;
        context += `- Folder: \`${proj.folder}\`\n`;
        context += `- Main Language: **${proj.language}** | Framework: **${proj.framework}**\n`;
        context += `- Goals: ${proj.goals.join(", ")}\n`;
        context += `- Architecture: ${proj.architecture}\n`;
        if (proj.completedFeatures.length > 0) {
          context += `- Completed Features: ${proj.completedFeatures.join(", ")}\n`;
        }
        if (proj.knownBugs.length > 0) {
          context += `- Known Bugs: ${proj.knownBugs.join(", ")}\n`;
        }
        if (proj.pendingTasks.length > 0) {
          context += `- Pending Project Tasks: ${proj.pendingTasks.join(", ")}\n`;
        }
        if (proj.importantFiles.length > 0) {
          context += `- Important Files: ${proj.importantFiles.join(", ")}\n`;
        }
        if (proj.recentConversations.length > 0) {
          context += `### Past Session Work Summaries:\n`;
          proj.recentConversations.slice(0, 3).forEach((summ: string, i: number) => {
            context += `  ${i + 1}. ${summ}\n`;
          });
        }
      }
    } catch (e) {
      console.error("[MemoryManager] Error adding project memory to pipeline context:", e);
    }

    context += `\nUse this persistent memory layer to act naturally, show empathy, adjust coding/personal preferences, recall pending projects, and resume conversation naturally without repeated onboarding!`;
    return context;
  }

  // ==========================================
  // 7. Full Privacy & Administration Controls
  // ==========================================
  public exportMemory(): string {
    const data = {
      Conversations: this.db.prepare("SELECT * FROM Conversations").all(),
      Messages: this.db.prepare("SELECT * FROM Messages").all(),
      LongTermMemory: this.db.prepare("SELECT * FROM LongTermMemory").all(),
      Tasks: this.db.prepare("SELECT * FROM Tasks").all(),
      ToolHistory: this.db.prepare("SELECT * FROM ToolHistory").all(),
      SearchHistory: this.db.prepare("SELECT * FROM SearchHistory").all(),
      EmotionHistory: this.db.prepare("SELECT * FROM EmotionHistory").all(),
      Aliases: this.db.prepare("SELECT * FROM Aliases").all(),
      Settings: this.db.prepare("SELECT * FROM Settings").all()
    };
    return JSON.stringify(data, null, 2);
  }

  public importMemory(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      this.db.transaction(() => {
        // Clear old tables
        this.db.exec(`
          DELETE FROM Messages;
          DELETE FROM Conversations;
          DELETE FROM LongTermMemory;
          DELETE FROM Tasks;
          DELETE FROM ToolHistory;
          DELETE FROM SearchHistory;
          DELETE FROM EmotionHistory;
          DELETE FROM Aliases;
          DELETE FROM Settings;
        `);

        // Helper inserters
        const insertConv = this.db.prepare("INSERT INTO Conversations (id, title, date, tags, timestamp, summary, keywords) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const insertMsg = this.db.prepare("INSERT INTO Messages (id, conversationId, sender, text, timestamp, isToolCall, toolDetails) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const insertLTM = this.db.prepare("INSERT INTO LongTermMemory (id, category, key, value, importance, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
        const insertTask = this.db.prepare("INSERT INTO Tasks (id, title, status, notes, project, timestamp) VALUES (?, ?, ?, ?, ?, ?)");
        const insertTool = this.db.prepare("INSERT INTO ToolHistory (id, conversationId, toolName, args, status, result, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)");
        const insertSearch = this.db.prepare("INSERT INTO SearchHistory (id, query, timestamp, resultsCount) VALUES (?, ?, ?, ?)");
        const insertEmotion = this.db.prepare("INSERT INTO EmotionHistory (id, emotion, timestamp) VALUES (?, ?, ?)");
        const insertAlias = this.db.prepare("INSERT INTO Aliases (id, shortcut, target, timestamp) VALUES (?, ?, ?, ?)");
        const insertSetting = this.db.prepare("INSERT INTO Settings (key, value) VALUES (?, ?)");

        if (Array.isArray(data.Conversations)) {
          data.Conversations.forEach((row: any) => {
            insertConv.run(row.id, row.title, row.date, row.tags, row.timestamp, row.summary || "", row.keywords || null);
          });
        }
        if (Array.isArray(data.Messages)) {
          data.Messages.forEach((row: any) => {
            insertMsg.run(row.id, row.conversationId, row.sender, row.text, row.timestamp, row.isToolCall || 0, row.toolDetails || null);
          });
        }
        if (Array.isArray(data.LongTermMemory)) {
          data.LongTermMemory.forEach((row: any) => {
            insertLTM.run(row.id, row.category, row.key, row.value, row.importance || "Low", row.timestamp);
          });
        }
        if (Array.isArray(data.Tasks)) {
          data.Tasks.forEach((row: any) => {
            insertTask.run(row.id, row.title, row.status, row.notes || "", row.project || "", row.timestamp);
          });
        }
        if (Array.isArray(data.ToolHistory)) {
          data.ToolHistory.forEach((row: any) => {
            insertTool.run(row.id, row.conversationId, row.toolName, row.args, row.status, row.result, row.timestamp);
          });
        }
        if (Array.isArray(data.SearchHistory)) {
          data.SearchHistory.forEach((row: any) => {
            insertSearch.run(row.id, row.query, row.timestamp, row.resultsCount || 0);
          });
        }
        if (Array.isArray(data.EmotionHistory)) {
          data.EmotionHistory.forEach((row: any) => {
            insertEmotion.run(row.id, row.emotion, row.timestamp);
          });
        }
        if (Array.isArray(data.Aliases)) {
          data.Aliases.forEach((row: any) => {
            insertAlias.run(row.id, row.shortcut, row.target, row.timestamp);
          });
        }
        if (Array.isArray(data.Settings)) {
          data.Settings.forEach((row: any) => {
            insertSetting.run(row.key, row.value);
          });
        }
      })();
      return true;
    } catch (e) {
      console.error("[MemoryManager] Error importing database memory:", e);
      return false;
    }
  }

  public clearAllMemories() {
    this.db.transaction(() => {
      this.db.exec(`
        DELETE FROM Messages;
        DELETE FROM Conversations;
        DELETE FROM LongTermMemory;
        DELETE FROM Tasks;
        DELETE FROM ToolHistory;
        DELETE FROM SearchHistory;
        DELETE FROM EmotionHistory;
        DELETE FROM Aliases;
        DELETE FROM Settings;
        DELETE FROM FactualQACache;
      `);
    })();
    console.log("[MemoryManager] All memory databases purged successfully.");
  }

  public getFactualQA(query: string): { query: string; answer: string; timestamp: number; sources?: string; provider?: string } | null {
    try {
      const q = query.trim().toLowerCase();
      const stmt = this.db.prepare("SELECT * FROM FactualQACache WHERE query = ?");
      const row: any = stmt.get(q);
      if (row) {
        return row;
      }
    } catch (e) {
      console.error("[MemoryManager] Error getting factual QA cache:", e);
    }
    return null;
  }

  public saveFactualQA(query: string, answer: string, provider: string, sources?: string[]) {
    try {
      const q = query.trim().toLowerCase();
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO FactualQACache (query, answer, timestamp, sources, provider)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(q, answer, Date.now(), sources ? JSON.stringify(sources) : null, provider);
      console.log(`[MemoryManager] Cached factual QA for: "${q}"`);
    } catch (e) {
      console.error("[MemoryManager] Error saving factual QA cache:", e);
    }
  }

  /**
   * Helper to execute arbitrary raw SQL queries safely.
   */
  public executeRaw(sql: string, params: any[] = []): any {
    try {
      const stmt = this.db.prepare(sql);
      if (sql.trim().toLowerCase().startsWith("select")) {
        return stmt.all(...params);
      } else {
        return stmt.run(...params);
      }
    } catch (e: any) {
      console.error(`[MemoryManager] Error executing raw SQL: ${e.message}`);
      throw e;
    }
  }

  /**
   * Purges cache entries older than 24 hours to keep database performance crisp.
   */
  public cleanOldQACache(): number {
    try {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare("DELETE FROM FactualQACache WHERE timestamp < ?");
      const result = stmt.run(oneDayAgo);
      return result.changes;
    } catch (e: any) {
      console.error("[MemoryManager] Failed to clean old QA cache:", e.message);
      return 0;
    }
  }

  /**
   * Public interface to rebuild tables if they suffer from corrupt schema issues.
   */
  public repairTables() {
    this.initializeTables();
  }
}
