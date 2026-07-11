import fs from "fs";
import path from "path";
import { MemoryManager } from "./MemoryManager";
import { callWithRetry } from "./GeminiRetry";

export interface JournalEntry {
  date: string;
  time: string;
  filesEdited: string[];
  featuresAdded: string[];
  bugsFixed: string[];
  ideasDiscussed: string[];
  commandsExecuted: string[];
  problemsRemaining: string[];
}

export class JournalManager {
  private static instance: JournalManager;
  private memoryManager = MemoryManager.getInstance();

  private constructor() {}

  public static getInstance(): JournalManager {
    if (!JournalManager.instance) {
      JournalManager.instance = new JournalManager();
    }
    return JournalManager.instance;
  }

  /**
   * Compiles the active session statistics into an elegant journal entry markdown and saves it.
   */
  public async generateAndSaveJournal(getGoogleGenAI: () => any): Promise<{ success: boolean; path?: string; content?: string }> {
    console.log("[JournalManager] Commencing session journal compile...");
    const date = new Date();
    const dateStr = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    // Extract commands run recently
    const recentLogs = this.memoryManager.getAllLongTermMemories()
      .filter(m => m.category === "tool_history" || m.category === "direct_skill")
      .slice(0, 10)
      .map(m => m.value);

    // Extract recent messages to deduce ideas discussed
    const recentMsgs = this.memoryManager.getRecentMessages(15);
    const discussionSummary = recentMsgs.map(m => `[${m.role}] ${m.text.substring(0, 120)}...`).join("\n");

    // Scan modified files
    const workspaceState = this.memoryManager.getSetting("workspace_state", {});
    const filesEdited = workspaceState.recentFiles || [];

    try {
      const ai = getGoogleGenAI();
      if (!ai) {
        throw new Error("Gemini SDK not initialized or available.");
      }

      const prompt = `You are Liya's Session Journal Compiler.
Compile a detailed, professional, human-style Markdown session journal entry for the current workspace session.

Current Date: ${dateStr}
Current Time: ${timeStr}
Files Edited: ${JSON.stringify(filesEdited)}
Recent Shell/Tool Commands: ${JSON.stringify(recentLogs)}
Recent Chat Discussion:
${discussionSummary}

Instructions:
1. Synthesize the inputs to extract:
   - "Features Added" (what features we worked on or finalized in the conversation)
   - "Bugs Fixed" (any fixes made)
   - "Ideas Discussed" (topics, architecture decisions, plans)
   - "Commands Executed" (tool commands or shell actions)
   - "Problems Remaining" (unresolved tasks, pending bugs, future steps)
2. Format the response as a pristine, scannable Markdown document starting with a title like "# Liya Session Journal - ${dateStr}".
3. Output the raw markdown content. No json wrappers or backticks are needed, just the clean markdown.`;

      const response = await callWithRetry<any>(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        })
      );

      const markdownContent = response.text?.trim() || "Failed to compile journal details.";

      // Target Save Directory: Liya/.memory/project_journal/
      const targetDir = path.join(process.cwd(), "Liya", ".memory", "project_journal");
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileSlug = `Session_Journal_${Date.now()}.md`;
      const targetPath = path.join(targetDir, fileSlug);
      
      fs.writeFileSync(targetPath, markdownContent, "utf-8");
      console.log(`[JournalManager] Successfully generated and wrote session journal to: ${targetPath}`);

      return {
        success: true,
        path: targetPath,
        content: markdownContent
      };
    } catch (err: any) {
      console.error("[JournalManager] Failed compiling session journal:", err);
      return {
        success: false,
        content: `Failed generating journal: ${err.message}`
      };
    }
  }
}
