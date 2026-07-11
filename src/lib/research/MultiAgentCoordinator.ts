import { MemoryManager } from "./MemoryManager";
import { TaskQueue } from "./TaskQueue";
import { AdaptivePersonality } from "./AdaptivePersonality";
import { BackgroundIntelligence } from "./BackgroundIntelligence";
import { SelfTestEngine } from "./SelfTestEngine";
import { Planner } from "./Planner";
import { DesktopManager } from "../desktop/DesktopManager";
import { SkillEngine } from "./SkillEngine";
import { BrowserResearchEngine } from "./BrowserResearchEngine";
import { VisionEngine } from "./VisionEngine";
import { ProjectMemoryManager } from "./ProjectMemoryManager";

export class MultiAgentCoordinator {
  private static instance: MultiAgentCoordinator;
  private memoryManager = MemoryManager.getInstance();
  private taskQueue = TaskQueue.getInstance();
  private adaptivePersonality = AdaptivePersonality.getInstance();
  private backgroundIntel = BackgroundIntelligence.getInstance();
  private selfTestEngine = SelfTestEngine.getInstance();

  private lastUserCommand: string = "";

  private constructor() {}

  public static getInstance(): MultiAgentCoordinator {
    if (!MultiAgentCoordinator.instance) {
      MultiAgentCoordinator.instance = new MultiAgentCoordinator();
    }
    return MultiAgentCoordinator.instance;
  }

  /**
   * Main orchestrator to run requests through our specialized agent brain (Feature 1).
   */
  public async coordinateAndExecute(
    text: string,
    getGoogleGenAI: () => any,
    wsSender: (payload: any) => void,
    onExecuteLocalTool?: (tool: { name: string; args: any; text: string }) => void,
    onAsyncResponse?: (text: string) => void
  ): Promise<{ responseText: string; spokenText: string; agentLogs: string[] }> {
    const agentLogs: string[] = [];
    agentLogs.push(`[Coordinator] Active user request: "${text}"`);

    // 1. Learn from user input style (Feature 5)
    this.adaptivePersonality.learnFromUserInput(text);

    // 2. Check for conversation corrections (Feature 13 - Universal Command Memory)
    const isCorrection = this.adaptivePersonality.detectAndRegisterCorrection(text, this.lastUserCommand);
    const resolvedCommand = this.adaptivePersonality.applyCommandCorrection(text);
    this.lastUserCommand = resolvedCommand;

    // 3. Conversation Flow Check: Interruption / Override handling (Feature 4)
    const lowerCommand = resolvedCommand.toLowerCase();
    const isInterruption = lowerCommand.startsWith("actually") || 
                          lowerCommand.startsWith("cancel") || 
                          lowerCommand.startsWith("no wait") || 
                          lowerCommand.startsWith("instead");

    if (isInterruption) {
      agentLogs.push("[Coordinator] Interruption detected. Cancelling active pipeline tasks...");
      wsSender({
        type: "log",
        sender: "system",
        text: "⚡ [Conversation Awareness] User interrupted previous activity. Cancelling tasks..."
      });
      this.taskQueue.cancelAllPending();
    }

    // 4. Inject Environmental Context (Feature 11)
    const contextLogs = this.gatherEnvironmentContext();
    contextLogs.forEach(log => agentLogs.push(log));

    // 5. Select target specialized internal agent & route work (Feature 1)
    const targetAgent = this.routeToSpecializedAgent(resolvedCommand);
    agentLogs.push(`[Coordinator] Delegated request to [${targetAgent} Agent]`);

    let responseText = "";

    try {
      switch (targetAgent) {
        case "Desktop": {
          wsSender({
            type: "log",
            sender: "system",
            text: `⚙️ [Desktop Agent] Handling desktop automation for: "${resolvedCommand}"`
          });
          
          const desktopManager = DesktopManager.getInstance();
          const result = await desktopManager.executeCommand(resolvedCommand);
          responseText = result.result?.message || result.log?.verificationMessage || `Executed desktop command.`;
          break;
        }

        case "Browser": {
          wsSender({
            type: "log",
            sender: "system",
            text: `⚙️ [Browser Agent] Researching web content...`
          });
          const browserEngine = BrowserResearchEngine.getInstance();
          const result = await browserEngine.searchWeb(resolvedCommand);
          responseText = result.length > 0 
            ? `Here is what I found on the web:\n\n${result.slice(0, 3).map((r, idx) => `**${idx+1}. ${r.title}**\n${r.snippet}\nSource: ${r.url}`).join("\n\n")}`
            : `I searched the web but couldn't find any relevant answers for "${resolvedCommand}".`;
          break;
        }

        case "Memory": {
          wsSender({
            type: "log",
            sender: "system",
            text: `⚙️ [Memory Agent] Extracting historic SQLite details...`
          });
          const memories = this.memoryManager.getAllLongTermMemories();
          responseText = memories.length > 0
            ? `Here is what I remember about your profile and preferences:\n\n` + memories.map(m => `- **${m.key}**: ${m.value}`).join("\n")
            : "I have no stored memories regarding this yet.";
          break;
        }

        case "Vision": {
          // Handled asynchronously by default
          const planner = Planner.getInstance();
          const res = await planner.planAndExecute(resolvedCommand, getGoogleGenAI, wsSender, onExecuteLocalTool, onAsyncResponse);
          responseText = res.responseText;
          break;
        }

        case "Coding": {
          wsSender({
            type: "log",
            sender: "system",
            text: `⚙️ [Coding Agent] Opening workspace analyzer...`
          });
          // Leverage multi-step reasoning for coding goals
          const planner = Planner.getInstance();
          const res = await planner.planAndExecute(resolvedCommand, getGoogleGenAI, wsSender, onExecuteLocalTool, onAsyncResponse);
          responseText = res.responseText;
          break;
        }

        case "Planner":
        case "Reasoning":
        default: {
          // Standard full reasoning & execution steps
          const planner = Planner.getInstance();
          const res = await planner.planAndExecute(resolvedCommand, getGoogleGenAI, wsSender, onExecuteLocalTool, onAsyncResponse);
          responseText = res.responseText;
          break;
        }
      }
    } catch (err: any) {
      agentLogs.push(`[Coordinator] Self-Healing fallback triggered for module failure: ${err.message}`);
      // Self-Healing recovery step: fallback reasoning
      responseText = `I encountered an unexpected issue delegating that action, but I've recovered gracefully. Here is how we can address it: ${err.message}`;
    }

    // 6. Track workflow for predictive suggestions (Feature 7)
    const nextSuggestedAction = this.adaptivePersonality.trackWorkflowAndSuggest(targetAgent);
    if (nextSuggestedAction) {
      const suggestText = this.adaptivePersonality.getSuggestionText(nextSuggestedAction);
      responseText += `\n\n💡 *Predictive Suggestion:* ${suggestText}`;
    }

    // 7. Formulate emotionally consistent wording (Feature 3)
    const currentEmotion = this.memoryManager.getSetting("current_emotion", "neutral");
    const spokenText = this.adaptivePersonality.prepareTextForSpeech(responseText, currentEmotion);

    return {
      responseText,
      spokenText,
      agentLogs
    };
  }

  /**
   * Evaluates text queries and matches them to specialized agents (Feature 1).
   */
  private routeToSpecializedAgent(text: string): "Planner" | "Desktop" | "Coding" | "Memory" | "Vision" | "Browser" | "Reasoning" | "Safety" {
    const lower = text.toLowerCase();

    // 1. Safety / confirmation overrides
    if (lower.includes("security") || lower.includes("confirm") || lower.includes("approve") || lower.includes("deny")) {
      return "Safety";
    }

    // 2. Multimodal Vision engine
    if (
      lower.includes("look") || 
      lower.includes("see") || 
      lower.includes("screen") || 
      lower.includes("screenshot") || 
      lower.includes("window") ||
      lower.includes("changed") ||
      lower.includes("different") ||
      lower.includes("explain this") ||
      lower.includes("read this") ||
      lower.includes("am i doing")
    ) {
      return "Vision";
    }

    // 3. Desktop controls
    const desktopKeywords = ["open", "launch", "start", "close", "kill", "calculator", "paint", "browser", "settings", "spotify", "notepad", "vsc", "vscode", "terminal", "editor"];
    const isDesktop = desktopKeywords.some(kw => lower.includes(kw));
    if (isDesktop && !lower.includes("code") && !lower.includes("debug") && !lower.includes("compile")) {
      return "Desktop";
    }

    // 4. Browser & search tasks
    const browserKeywords = ["search", "google", "find on the web", "weather", "news", "website", "url", "read page"];
    if (browserKeywords.some(kw => lower.includes(kw))) {
      return "Browser";
    }

    // 5. Memory retrieval
    if (lower.includes("remember") || lower.includes("what is my") || lower.includes("memory") || lower.includes("profile")) {
      return "Memory";
    }

    // 6. Project Coding Agent
    const codingKeywords = ["code", "create a website", "debug", "compile", "refactor", "git", "database", "sqlite", "express", "backend", "test", "build"];
    if (codingKeywords.some(kw => lower.includes(kw))) {
      return "Coding";
    }

    // 7. Fallback to generic Planner/Reasoning
    if (lower.includes("why") || lower.includes("how") || lower.includes("explain") || lower.includes("solve")) {
      return "Reasoning";
    }

    return "Planner";
  }

  /**
   * Extracts detailed system metadata to achieve precise context awareness (Feature 11).
   */
  private gatherEnvironmentContext(): string[] {
    const logs: string[] = [];
    const now = new Date();
    
    // Time of day
    const hours = now.getHours();
    let timeOfDay = "Morning";
    if (hours >= 12 && hours < 17) timeOfDay = "Afternoon";
    else if (hours >= 17) timeOfDay = "Evening";

    logs.push(`[Context Awareness] Time of Day: ${timeOfDay} (${now.toLocaleTimeString()})`);

    // Active environment app
    const activeApp = this.memoryManager.getSetting("active_app", "None");
    logs.push(`[Context Awareness] Currently active window: "${activeApp}"`);

    // Active project language
    const currentProj = ProjectMemoryManager.getInstance().detectAndLoadProject(process.cwd());
    logs.push(`[Context Awareness] Active project framework: "${currentProj.framework || "TypeScript"}"`);

    return logs;
  }
}
