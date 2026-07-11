import Database from "better-sqlite3";
import path from "path";

export interface TimelineEvent {
  id: string;
  timestamp: number;
  dateStr: string; // "July 9, 2026", etc.
  title: string;
  description: string;
  category: "feature" | "bug" | "memory" | "browser" | "desktop" | "system";
}

export class TimelineManager {
  private static instance: TimelineManager;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(process.cwd(), "liya.db");
    this.db = new Database(dbPath);
    this.initializeTable();
    this.seedDefaultTimeline();
  }

  public static getInstance(): TimelineManager {
    if (!TimelineManager.instance) {
      TimelineManager.instance = new TimelineManager();
    }
    return TimelineManager.instance;
  }

  private initializeTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Timeline (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        dateStr TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL
      );
    `);
  }

  private seedDefaultTimeline() {
    const check = this.db.prepare("SELECT count(*) as count FROM Timeline").get() as { count: number };
    if (check.count === 0) {
      const now = Date.now();
      const insert = this.db.prepare(`
        INSERT INTO Timeline (id, timestamp, dateStr, title, description, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      // Default historic timeline
      const msPerDay = 24 * 60 * 60 * 1000;
      insert.run("ev_1", now - 11 * msPerDay, "June 28, 2026", "Desktop Control Added", "Implemented deterministic desktop app launcher, browser window controller, and shell execution.", "desktop");
      insert.run("ev_2", now - 9 * msPerDay, "June 30, 2026", "Persistent Memory Implemented", "Configured robust SQLite tables to preserve user settings, chat dialogues, and creator profile.", "memory");
      insert.run("ev_3", now - 7 * msPerDay, "July 2, 2026", "Browser Search Upgraded", "Enhanced full-text search engine with live duckduckgo results, citation managers, and fact caching.", "browser");
      insert.run("ev_4", now - 5 * msPerDay, "July 4, 2026", "Wake Word Experiment Reverted", "Reverted audio wake-word listener loop to maintain performance and lower container overhead.", "system");
      insert.run("ev_5", now - 2 * msPerDay, "Yesterday", "Vision Mode Added", "Added high-fidelity vision screenshot parser with deep multimodal prompt analysis.", "feature");
      insert.run("ev_6", now, "Today", "Liya Architecture Refactored", "Successfully completed the Multi-Engine AI Assistant refactor with Master Planner, Skill Engine, and Verification Engine.", "system");
    }
  }

  /**
   * Record a new event/milestone in the timeline.
   */
  public addEvent(title: string, description: string, category: TimelineEvent["category"]): TimelineEvent {
    const timestamp = Date.now();
    const date = new Date();
    
    // Friendly date representation
    const dateStr = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const id = "evt_" + Math.random().toString(36).substring(2, 9);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO Timeline (id, timestamp, dateStr, title, description, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, timestamp, dateStr, title, description, category);

    return { id, timestamp, dateStr, title, description, category };
  }

  /**
   * Retrieves timeline history sorted chronologically.
   */
  public getTimelineEvents(limit = 20): TimelineEvent[] {
    const stmt = this.db.prepare("SELECT * FROM Timeline ORDER BY timestamp DESC LIMIT ?");
    const rows = stmt.all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      dateStr: r.dateStr,
      title: r.title,
      description: r.description,
      category: r.category as any
    }));
  }

  /**
   * Formats the timeline events into a clean textual list.
   */
  public getFormattedTimeline(): string {
    const events = this.getTimelineEvents();
    if (events.length === 0) return "No timeline events recorded.";
    
    // Group by Date to match the user's requested timeline format
    const grouped: Record<string, TimelineEvent[]> = {};
    for (const evt of events) {
      if (!grouped[evt.dateStr]) grouped[evt.dateStr] = [];
      grouped[evt.dateStr].push(evt);
    }

    let timelineText = "";
    for (const [dateStr, evts] of Object.entries(grouped)) {
      timelineText += `\n### ${dateStr}\n`;
      for (const evt of evts) {
        timelineText += `- **${evt.title}** (${evt.category}): ${evt.description}\n`;
      }
    }
    return timelineText;
  }
}
