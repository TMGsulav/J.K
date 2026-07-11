import { MemoryManager } from "./MemoryManager";
import { SkillEngine, Skill } from "./SkillEngine";
import { BrowserResearchEngine } from "./BrowserResearchEngine";
import { VerificationEngine } from "./VerificationEngine";
import { VisionEngine } from "./VisionEngine";
import { VisionManager } from "./VisionManager";
import { callWithRetry, robustParseJSON } from "./GeminiRetry";
import { checkIfNeedsReasoning } from "./QuestionAnswerPipeline";
import { ProjectMemoryManager } from "./ProjectMemoryManager";
import { WorkspaceManager } from "./WorkspaceManager";
import { TimelineManager } from "./TimelineManager";
import { JournalManager } from "./JournalManager";
import { ContextBuilder } from "./ContextBuilder";
import path from "path";

export interface PlanStep {
  id: string;
  engine: "Skill" | "Reasoning" | "Browser" | "Memory" | "Vision";
  action: string;
  args: any;
  description: string;
}

export interface Plan {
  thought: string;
  steps: PlanStep[];
}

export interface ExecutionLog {
  stepId: string;
  intent: string;
  selectedSubsystem: string;
  executionTimeMs: number;
  verificationResult: {
    success: boolean;
    message: string;
    recoveryAttempts: number;
  };
  errors: string[];
  recoveryAttempts: number;
}

export class Planner {
  private static instance: Planner;
  private memoryManager = MemoryManager.getInstance();
  private skillEngine = SkillEngine.getInstance();
  private browserEngine = BrowserResearchEngine.getInstance();
  private verificationEngine = VerificationEngine.getInstance();
  private visionEngine = VisionEngine.getInstance();
  private projectMemoryManager = ProjectMemoryManager.getInstance();
  private workspaceManager = WorkspaceManager.getInstance();
  private timelineManager = TimelineManager.getInstance();
  private journalManager = JournalManager.getInstance();
  private contextBuilder = ContextBuilder.getInstance();

  private constructor() {}

  public static getInstance(): Planner {
    if (!Planner.instance) {
      Planner.instance = new Planner();
    }
    return Planner.instance;
  }

  /**
   * Main entry point to plan and execute a user command.
   * Leverages deterministic skill engines first, or falls back to multi-step planning and verification.
   */
  public async planAndExecute(
    text: string,
    getGoogleGenAI: () => any,
    wsSender: (logPayload: any) => void,
    onExecuteLocalTool?: (tool: { name: string; args: any; text: string }) => void,
    onAsyncResponse?: (text: string) => void
  ): Promise<{ responseText: string; logs: ExecutionLog[] }> {
    const overallStartTime = Date.now();
    const executionLogs: ExecutionLog[] = [];

    console.log(`[Planner] Planning & executing query: "${text}"`);

    // 0. Specialized Phase 2 Intents (Vision, Resume, Journal, Timeline)
    const queryLower = text.toLowerCase();
    const isChangeRequest = queryLower.includes("what changed") || 
                            queryLower.includes("what did i just open") || 
                            queryLower.includes("what is different") ||
                            queryLower.includes("what's different");

    if (isChangeRequest || this.isVisionRequest(text)) {
      console.log(`[Planner] Detected Vision Request (IsChange: ${isChangeRequest}). Coordinating via VisionManager...`);
      wsSender({
        type: "log",
        sender: "system",
        text: isChangeRequest 
          ? "⚙️ [Vision Manager] Change detection request received. Comparing consecutive screen frames..."
          : "⚙️ [Vision Manager] Active screen request received. Assuring visual freshness..."
      });

      if (onAsyncResponse) {
        const handleVision = async () => {
          const visionManager = VisionManager.getInstance();
          if (isChangeRequest) {
            return await visionManager.compareFramesAndAnalyze(getGoogleGenAI);
          } else {
            return await visionManager.captureAndAnalyzeScreen(text, getGoogleGenAI, wsSender);
          }
        };

        handleVision()
          .then((analysis) => {
            const observedWindows: string[] = [];
            const commonApps = ["vscode", "chrome", "terminal", "notepad", "calculator", "browser", "spotify", "explorer", "github"];
            for (const app of commonApps) {
              if (analysis.toLowerCase().includes(app)) {
                observedWindows.push(app);
              }
            }

            this.timelineManager.addEvent(
              isChangeRequest ? "Screen Change Analysis" : "Screen Visual Analysis",
              isChangeRequest 
                ? "Compared consecutive screen frames to identify active workspace changes."
                : `Analyzed screen content for user query: "${text}". Found application: ${observedWindows.join(", ") || "Active Desktop"}.`,
              "feature"
            );
            onAsyncResponse(analysis);
          })
          .catch((err) => {
            onAsyncResponse(`Sorry, I encountered an error during visual analysis: ${err.message}`);
          });
      }

      return {
        responseText: isChangeRequest
          ? "I am comparing your previous screen capture with the latest one to see what changed. This runs asynchronously to never block our conversation. I'll describe the changes in just a moment!"
          : "I am analyzing your active screen right now using my live screen awareness engine. This runs asynchronously to never block our conversation. I'll share my visual analysis with you in just a moment!",
        logs: []
      };
    }

    if (this.isResumeProjectRequest(text)) {
      console.log("[Planner] Detected Resume Project Request.");
      wsSender({
        type: "log",
        sender: "system",
        text: "⚙️ [Project Memory] Resuming latest project context..."
      });

      const cwd = process.cwd();
      const project = this.projectMemoryManager.detectAndLoadProject(cwd);
      
      const ai = getGoogleGenAI();
      const prompt = `You are Liya, an intelligent workspace companion.
The user wants to resume their latest project.
Here is the project memory retrieved from our SQLite database:
Project Name: ${project.name}
Folder Path: ${project.folder}
Languages: ${project.language}
Frameworks/Runtime: ${project.framework}
Architecture Summary: ${project.architecture}
Completed Features: ${JSON.stringify(project.completedFeatures)}
Pending Tasks: ${JSON.stringify(project.pendingTasks)}
Known Bugs: ${JSON.stringify(project.knownBugs)}
Important Files: ${JSON.stringify(project.importantFiles)}

Summarize this project beautifully:
1. Last session / status overview
2. What has been completed
3. Pending work and roadmaps
4. Suggest a concrete next task to continue with.

Keep it highly scannable, clean, and professional.`;

      const response = await callWithRetry<any>(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        })
      );

      const responseText = response.text?.trim() || "Successfully loaded project.";
      this.timelineManager.addEvent("Project Resumed", `Successfully reloaded context for project: "${project.name}".`, "system");

      return {
        responseText,
        logs: []
      };
    }

    if (this.isJournalRequest(text)) {
      console.log("[Planner] Detected Session Journal Request.");
      wsSender({
        type: "log",
        sender: "system",
        text: "⚙️ [Journal Manager] Compiling session metrics and writing journal entry..."
      });

      const journalResult = await this.journalManager.generateAndSaveJournal(getGoogleGenAI);
      if (journalResult.success) {
        this.timelineManager.addEvent("Session Journal Compiled", "Generated and saved work session journal markdown.", "system");
        return {
          responseText: `### 📓 Session Journal Compiled Successfully!\n\nI have automatically summarized today's progress (files edited, features added, bugs resolved, discussed ideas, and remaining problems) and saved it inside your workspace at \`Liya/.memory/project_journal/\`.\n\nHere is a preview of the compiled journal:\n\n${journalResult.content}`,
          logs: []
        };
      } else {
        return {
          responseText: `Failed to compile session journal: ${journalResult.content}`,
          logs: []
        };
      }
    }

    if (this.isTimelineQuery(text)) {
      console.log("[Planner] Detected Timeline Query.");
      wsSender({
        type: "log",
        sender: "system",
        text: "⚙️ [Timeline Manager] Querying historic milestone database..."
      });

      const timelineText = this.timelineManager.getFormattedTimeline();
      const ai = getGoogleGenAI();
      const prompt = `You are Liya, an intelligent AI workspace companion.
The user is asking about the timeline of features/changes: "${text}"
Here is the raw chronological timeline from our SQLite database:
${timelineText}

Provide a clean, elegant, human-style summary of what we accomplished on each day. Do not use complex system logs; make it look like a pristine development changelog.`;

      const response = await callWithRetry<any>(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        })
      );

      return {
        responseText: response.text?.trim() || timelineText,
        logs: []
      };
    }

    // 1. Layer 2 Check: If a deterministic matching skill exists, execute it immediately (LLM Bypassed)
    const directSkill = this.skillEngine.findMatchingSkill(text);
    if (directSkill) {
      console.log(`[Planner] [Layer 2 - Skill Engine] Deterministic match found: "${directSkill.name}"`);
      const stepStartTime = Date.now();
      
      let res: any;
      let verResult = { success: true, message: "Bypassed verification.", recoveryAttempts: 0 };
      const errorsList: string[] = [];

      try {
        // Execute through Verification Engine
        verResult = await this.verificationEngine.verifyAndRecover(
          "SkillEngine",
          directSkill.id,
          { text },
          async (args) => {
            res = await directSkill.execute(args.text);
            if (res?.toolName && onExecuteLocalTool) {
              onExecuteLocalTool({ name: res.toolName, args: res.args, text: res.responseText });
            }
            return res;
          }
        );
      } catch (err: any) {
        errorsList.push(err.message || String(err));
        verResult = { success: false, message: `Skill execution exception: ${err.message}`, recoveryAttempts: 0 };
      }

      const executionTime = Date.now() - stepStartTime;
      const logEntry: ExecutionLog = {
        stepId: "direct_skill",
        intent: directSkill.id,
        selectedSubsystem: "Skill Engine",
        executionTimeMs: executionTime,
        verificationResult: verResult,
        errors: errorsList,
        recoveryAttempts: verResult.recoveryAttempts
      };
      executionLogs.push(logEntry);

      // Record telemetry log (Layer 8 - Logging)
      this.saveAndDispatchLog(logEntry, wsSender);

      // Protect against regression by running existing regression checks
      await this.runRegressionProtectionCheck(wsSender);

      return {
        responseText: res?.responseText || `Executed local skill: ${directSkill.name}. Verification: ${verResult.message}`,
        logs: executionLogs
      };
    }

    // 2. Layer 1 Check: Generate a modular multi-step execution plan
    let plan: Plan;
    try {
      plan = await this.generatePlan(text, getGoogleGenAI);
      console.log(`[Planner] Generated execution plan:`, JSON.stringify(plan, null, 2));
    } catch (err: any) {
      console.warn(`[Planner] Structured plan generation failed, falling back to simple Reasoning step:`, err.message);
      plan = {
        thought: "Fallback to single Reasoning Engine execution step.",
        steps: [
          {
            id: "step_1",
            engine: "Reasoning",
            action: "executeQAPipeline",
            args: { query: text },
            description: "Direct reasoning fallback"
          }
        ]
      };
    }

    // 3. Sequential Execution of each step
    const executionContext: Record<string, any> = {
      userGoal: text,
      stepResults: {}
    };

    for (const step of plan.steps) {
      console.log(`[Planner] Executing Step "${step.id}": [Subsystem: ${step.engine}] - ${step.description}`);
      const stepStartTime = Date.now();
      const errorsList: string[] = [];
      let stepResult: any = null;
      let verResult = { success: true, message: "Nominal success", recoveryAttempts: 0 };

      try {
        switch (step.engine) {
          case "Browser": {
            // Layer 6 - Browser Engine research
            if (step.action === "searchWeb") {
              const query = this.resolveArgs(step.args.query, executionContext);
              stepResult = await this.browserEngine.searchWeb(query);
            } else if (step.action === "readWebpage") {
              const url = this.resolveArgs(step.args.url, executionContext);
              stepResult = await this.browserEngine.readWebpage(url);
            }
            break;
          }

          case "Skill": {
            // Layer 2 - Deterministic local skill execution
            const skillId = step.action;
            const skillArgs = this.resolveArgs(step.args, executionContext);
            const matchingSkill = this.skillEngine.getSkills().find(s => s.id === skillId);
            
            if (matchingSkill) {
              // Execute and verify via VerificationEngine
              verResult = await this.verificationEngine.verifyAndRecover(
                "Skill",
                skillId,
                skillArgs,
                async (resolvedArgs) => {
                  const executeRes = await matchingSkill.execute(resolvedArgs.text || text, resolvedArgs);
                  if (executeRes?.toolName && onExecuteLocalTool) {
                    onExecuteLocalTool({ name: executeRes.toolName, args: executeRes.args, text: executeRes.responseText });
                  }
                  return executeRes;
                }
              );
              stepResult = verResult;
            } else {
              throw new Error(`Skill Registry missing requested skill ID: ${skillId}`);
            }
            break;
          }

          case "Reasoning": {
            // Layer 3 - Reasoning Engine execution
            const reasoningPrompt = this.resolveArgs(step.args.query || step.args.prompt || text, executionContext);
            const ai = getGoogleGenAI();
            
            const contextString = this.contextBuilder.buildFullWorkspaceContext();
            const finalPrompt = `System instructions: You are Liya, an expert AI assistant.
Current memory:
${contextString}

Previous steps context:
${JSON.stringify(executionContext.stepResults)}

Goal: ${reasoningPrompt}
Output the final response clearly:`;

            const response: any = await callWithRetry(() =>
              ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: finalPrompt
              })
            );

            stepResult = response.text?.trim() || "";
            break;
          }

          case "Memory": {
            // Layer 5 - Memory Engine state persistence
            const category = step.args.category || "user_preference";
            const key = this.resolveArgs(step.args.key, executionContext);
            const value = this.resolveArgs(step.args.value, executionContext);
            
            if (step.action === "saveTask") {
              const taskId = "task_" + Math.random().toString(36).substring(2, 9);
              this.memoryManager.saveTask(taskId, key, "pending", value);
              stepResult = { success: true, taskId, message: "Task recorded safely." };
            } else {
              this.memoryManager.updateLongTermMemory(category, key, value, step.args.importance || "Low");
              stepResult = { success: true, message: "Preference saved successfully." };
            }
            break;
          }

          case "Vision": {
            // Layer 7 - Vision Engine screenshot check
            const base64Image = step.args.image;
            const query = this.resolveArgs(step.args.query || text, executionContext);
            if (base64Image) {
              stepResult = await this.visionEngine.analyzeScreen(base64Image, query, getGoogleGenAI);
            } else {
              stepResult = { success: false, message: "Vision step skipped - image data missing." };
            }
            break;
          }

          default:
            throw new Error(`Planner encountered unsupported engine type: ${step.engine}`);
        }
      } catch (err: any) {
        errorsList.push(err.message || String(err));
        verResult = { success: false, message: `Step execution crashed: ${err.message}`, recoveryAttempts: 0 };
        console.error(`[Planner] Crash on Step "${step.id}":`, err);
      }

      const stepDuration = Date.now() - stepStartTime;
      executionContext.stepResults[step.id] = stepResult;

      // Log step (Layer 8 - Logging)
      const stepLog: ExecutionLog = {
        stepId: step.id,
        intent: step.action,
        selectedSubsystem: step.engine,
        executionTimeMs: stepDuration,
        verificationResult: verResult,
        errors: errorsList,
        recoveryAttempts: verResult.recoveryAttempts
      };

      executionLogs.push(stepLog);
      this.saveAndDispatchLog(stepLog, wsSender);
    }

    // 4. Synthesize final response conversational outcome
    const synthesizeStartTime = Date.now();
    const finalAnswer = await this.synthesizeFinalResponse(text, executionContext, getGoogleGenAI);

    // Save final telemetries
    console.log(`[Planner] Full execution completed successfully in ${Date.now() - overallStartTime}ms.`);

    // 5. Regression Protection: Test all skills
    await this.runRegressionProtectionCheck(wsSender);

    return {
      responseText: finalAnswer,
      logs: executionLogs
    };
  }

  /**
   * Uses Gemini to generate a structured multi-step execution plan for complex commands.
   */
  private async generatePlan(text: string, getGoogleGenAI: () => any): Promise<Plan> {
    const ai = getGoogleGenAI();
    const availableSkillsList = this.skillEngine.getSkills().map(s => `${s.id} (${s.name})`);

    const plannerInstruction = `You are Liya's master Layer 1 Planner.
Your job is to take a user instruction and decompose it into small sequential executable steps.
You MUST never directly control the desktop, but instead delegate actions to one of the following available Engines:

1. "Browser" (Web Research) - Actions: "searchWeb" (takes args: { query: string }), "readWebpage" (takes args: { url: string }).
2. "Skill" (Desktop/OS Automation) - Use for file actions, clipboard, window, volume, app launch. Action should match a skill ID from the list: [${availableSkillsList.join(", ")}].
3. "Reasoning" (AI Logic/Coding/Explanations) - Actions: "generateCode", "explainTopic", "summarize".
4. "Memory" (Saving details/Preferences) - Actions: "savePreference", "saveTask" (takes args: { key: string, value: string }).
5. "Vision" (Screenshots) - Actions: "analyzeScreenshot".

Return a strictly valid JSON response following this precise JSON structure:
{
  "thought": "A brief explanation of how you are decomposing this goal.",
  "steps": [
    {
      "id": "step_1",
      "engine": "Browser",
      "action": "searchWeb",
      "args": { "query": "latest news on nextjs 2026" },
      "description": "Search for news"
    }
  ]
}

If the user query is simple conversation or single-hop reasoning (e.g., coding assistance or answering a question), return a single step with "Reasoning" engine.

User Instruction: "${text}"`;

    const response = await callWithRetry<any>(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: plannerInstruction,
        config: {
          responseMimeType: "application/json"
        }
      })
    );

    const rawJson = response.text?.trim() || "{}";
    return robustParseJSON<Plan>(rawJson);
  }

  /**
   * Uses Gemini to synthesize a beautiful final conversational explanation summarizing execution.
   */
  private async synthesizeFinalResponse(
    userGoal: string,
    context: Record<string, any>,
    getGoogleGenAI: () => any
  ): Promise<string> {
    const ai = getGoogleGenAI();
    
    const contextString = this.contextBuilder.buildFullWorkspaceContext();
    const smartSuggestion = this.generateSmartSuggestion();

    const synthesisPrompt = `You are Liya, the helpful AI assistant.
The user wanted: "${userGoal}"

We have executed the plan. Here are the outputs of the intermediate steps:
${JSON.stringify(context.stepResults, null, 2)}

Original Human Memory State:
${contextString}

Synthesize a friendly, brilliant, clear, and highly professional final response answering the user's original goal using the collected step results. Do not output internal developer jargon or step IDs; make it elegant and conversational.

Finally, append the following Smart Suggestion at the very end as a friendly, non-repetitive, contextual question/suggestion:
"${smartSuggestion}"`;

    const response = await callWithRetry<any>(() =>
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: synthesisPrompt
      })
    );

    return response.text?.trim() || "Completed successfully.";
  }

  /**
   * Resolves arguments that may reference outputs of previous steps (e.g. "$step_1.results")
   */
  private resolveArgs(args: any, context: Record<string, any>): any {
    if (typeof args === "string") {
      if (args.startsWith("$")) {
        const path = args.slice(1).split(".");
        let curr = context.stepResults;
        for (const token of path) {
          if (curr && typeof curr === "object") {
            curr = curr[token];
          } else {
            return args;
          }
        }
        return curr || args;
      }
      return args;
    }
    if (Array.isArray(args)) {
      return args.map(item => this.resolveArgs(item, context));
    }
    if (args && typeof args === "object") {
      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(args)) {
        resolved[key] = this.resolveArgs(val, context);
      }
      return resolved;
    }
    return args;
  }

  /**
   * Saves execution details to SQLite database memory and dispatches live telemetry.
   */
  private saveAndDispatchLog(log: ExecutionLog, wsSender: (logPayload: any) => void) {
    try {
      this.memoryManager.saveToolHistory(
        log.stepId + "_" + Date.now(),
        null,
        log.intent,
        { selectedSubsystem: log.selectedSubsystem, errors: log.errors, recoveryAttempts: log.recoveryAttempts },
        log.verificationResult.success ? "success" : "error",
        log.verificationResult
      );

      const statusText = log.verificationResult.success ? "✅ Success" : "❌ Failed";
      const telemetryText = `⚙️ [Subsystem Log] Engine: **${log.selectedSubsystem}** | Action: \`${log.intent}\` | State: ${statusText} | Execution: ${log.executionTimeMs}ms | Retries: ${log.recoveryAttempts}`;
      
      console.log(`[Planner Log] ${telemetryText}`);
      wsSender({
        type: "log",
        sender: "system",
        text: telemetryText
      });
    } catch (e) {
      console.error("[Planner] Failed saving log to SQLite database:", e);
    }
  }

  /**
   * Regression Protection System:
   * Run automated tests to make sure that no existing skill or capability regress on codebase modifications.
   */
  private async runRegressionProtectionCheck(wsSender: (logPayload: any) => void) {
    console.log("[Planner] Activating Layer 9 Regression Protection...");
    const testResult = await this.skillEngine.runRegressionTests();
    
    if (testResult.passed) {
      const statusText = `🛡️ [Regression Protection] All ${testResult.results.length} core skills passed validation checks! Capability regressed: None.`;
      console.log(statusText);
      wsSender({
        type: "log",
        sender: "system",
        text: statusText
      });
    } else {
      const failedCount = testResult.results.filter(r => r.status === "failed" || r.status === "crashed").length;
      const statusText = `⚠️ [Regression Protection WARNING] ${failedCount} core skill regression checks FAILED! Please audit the latest codebase modification.`;
      console.warn(statusText);
      wsSender({
        type: "log",
        sender: "system",
        text: statusText
      });
    }
  }

  private isVisionRequest(text: string): boolean {
    const query = text.toLowerCase();
    return (
      query.includes("look at my screen") ||
      query.includes("what do you see") ||
      query.includes("read this") ||
      query.includes("explain this") ||
      query.includes("which window is open") ||
      query.includes("what am i doing") ||
      query.includes("what is this error") ||
      query.includes("explain this error") ||
      query.includes("read my screen") ||
      query.includes("what should i click") ||
      query.includes("explain this code on my screen") ||
      query.includes("what is on my screen") ||
      query.includes("read this on my screen") ||
      query.includes("screenshot of my screen") ||
      query.includes("analyze my screen") ||
      query.includes("summarize this webpage") ||
      query.includes("summarize what's on my screen")
    );
  }

  private isResumeProjectRequest(text: string): boolean {
    const query = text.toLowerCase();
    return (
      query.includes("continue my project") ||
      query.includes("resume my project") ||
      query.includes("continue project") ||
      query.includes("resume project") ||
      query.includes("continue my liya project")
    );
  }

  private isJournalRequest(text: string): boolean {
    const query = text.toLowerCase();
    return (
      query.includes("end session") ||
      query.includes("save journal") ||
      query.includes("compile journal") ||
      query.includes("generate journal") ||
      query.includes("close session") ||
      query.includes("write session journal")
    );
  }

  private isTimelineQuery(text: string): boolean {
    const query = text.toLowerCase();
    return (
      query.includes("what did we do yesterday") ||
      query.includes("what changed this week") ||
      query.includes("what features have we completed") ||
      query.includes("show timeline") ||
      query.includes("milestones") ||
      query.includes("view timeline")
    );
  }

  private generateSmartSuggestion(): string {
    const wsState = this.workspaceManager.getWorkspaceState();
    const app = wsState.currentApplication.toLowerCase();
    
    if (app.includes("vscode") || app.includes("code")) {
      return `I noticed you're active in VS Code. Since we're working on ${path.basename(process.cwd())}, would you like me to analyze any syntax errors or compile-time warnings on the current file?`;
    } else if (app.includes("chrome") || app.includes("browser")) {
      return `I noticed you're browsing. Would you like me to open your GitHub repository dashboard or check the latest open issues?`;
    } else {
      return `I'm tracking your workspace state in the background. Whenever you'd like to resume, just say "Continue my project" to pick up right where we left off!`;
    }
  }
}
