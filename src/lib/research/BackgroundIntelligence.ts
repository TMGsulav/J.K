import { MemoryManager } from "./MemoryManager";
import { ProjectMemoryManager } from "./ProjectMemoryManager";
import fs from "fs";
import path from "path";

export interface SmartNotification {
  id: string;
  type: "build_success" | "build_failure" | "task_complete" | "git_conflict" | "download_complete";
  message: string;
  timestamp: number;
}

export class BackgroundIntelligence {
  private static instance: BackgroundIntelligence;
  private memoryManager = MemoryManager.getInstance();
  private projectMemoryManager = ProjectMemoryManager.getInstance();
  private isProcessing = false;
  private lastNotificationTime: Record<string, number> = {};

  private constructor() {
    this.startBackgroundLoop();
  }

  public static getInstance(): BackgroundIntelligence {
    if (!BackgroundIntelligence.instance) {
      BackgroundIntelligence.instance = new BackgroundIntelligence();
    }
    return BackgroundIntelligence.instance;
  }

  /**
   * Periodically runs idle tasks with low CPU footprint (Feature 9).
   */
  private startBackgroundLoop() {
    // Run background optimization tasks every 60 seconds
    setInterval(async () => {
      if (this.isProcessing) return;
      
      // Prevent high CPU usage by checking if there is heavy system workload (simulated detection)
      const isSystemHeavy = this.detectHeavyWorkload();
      if (isSystemHeavy) {
        console.log("[BackgroundIntelligence] Heavy system workload detected (gaming/compiling). Background tasks paused.");
        return;
      }

      this.isProcessing = true;
      try {
        console.log("[BackgroundIntelligence] Running background idle optimization routines...");
        
        // 1. Clean old FactualQACache entries older than 24 hours
        const purgedCount = this.memoryManager.cleanOldQACache();
        if (purgedCount > 0) {
          console.log(`[BackgroundIntelligence] Purged ${purgedCount} expired entries from FactualQACache.`);
        }

        // 2. Index project structure dynamically (Feature 9)
        const cwd = process.cwd();
        this.projectMemoryManager.detectAndLoadProject(cwd);

        // 3. Clean temporary cache directories safely (Feature 9)
        this.cleanTmpDirectory();

      } catch (err: any) {
        console.warn("[BackgroundIntelligence] Background task error:", err.message);
      } finally {
        this.isProcessing = false;
      }
    }, 60000);
  }

  /**
   * Helper to detect heavy system workloads to prevent CPU hogging.
   */
  private detectHeavyWorkload(): boolean {
    try {
      // Check active load or process statuses - e.g., if there are active compilation logs or running servers
      // We read a state setting indicating active intensive jobs
      const activeIntensive = this.memoryManager.getSetting("active_heavy_workload", false);
      return activeIntensive === true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Cleans any stray temporary files in Liya's local cache without touching essential files (Feature 9).
   */
  private cleanTmpDirectory() {
    const tmpDir = path.join(process.cwd(), "Liya", ".memory", "tmp_cache");
    if (!fs.existsSync(tmpDir)) return;

    try {
      const files = fs.readdirSync(tmpDir);
      const now = Date.now();
      const expiry = 6 * 60 * 60 * 1000; // 6 hours

      for (const file of files) {
        const fullPath = path.join(tmpDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > expiry) {
            fs.unlinkSync(fullPath);
            console.log(`[BackgroundIntelligence] Cleaned temporary cache file: ${file}`);
          }
        } catch (_) {}
      }
    } catch (e: any) {
      console.warn("[BackgroundIntelligence] Error cleaning tmp directory:", e.message);
    }
  }

  /**
   * Dispatches smart notifications while preventing spamming/flooding (Feature 10).
   */
  public dispatchSmartNotification(
    type: SmartNotification["type"],
    message: string,
    wsSender?: (payload: any) => void
  ): boolean {
    const now = Date.now();
    const lastTime = this.lastNotificationTime[type] || 0;
    
    // Prevent duplicate notification spamming if same type is sent in under 5 seconds
    const spamLimit = 5000; 
    if (now - lastTime < spamLimit) {
      console.log(`[Smart Notifications] Suppressed duplicate notification for type: "${type}" to prevent spamming.`);
      return false;
    }

    this.lastNotificationTime[type] = now;
    console.log(`[Smart Notifications] Sending [${type}]: ${message}`);

    if (wsSender) {
      try {
        wsSender({
          type: "smartNotification",
          notification: {
            id: "notif_" + Math.random().toString(36).substring(2, 9),
            type,
            message,
            timestamp: now
          }
        });
      } catch (err: any) {
        console.error("[Smart Notifications] Websocket push failed:", err.message);
      }
    }

    return true;
  }
}
