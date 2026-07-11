import os from "os";
import { detectIntent, IntentType } from "./IntentDetector";
import { MemoryManager } from "./MemoryManager";
import { checkIfBenefitsFromSearch } from "./QuestionAnswerPipeline";
import { optimizeQueryAndDestination } from "./QueryOptimizer";
import { ProjectMemoryManager } from "./ProjectMemoryManager";
import { SkillEngine } from "./SkillEngine";

export interface RoutedResult {
  runLocal: boolean;
  toolName?: string;
  args?: any;
  responseText: string;
  intent: IntentType;
}

/**
 * Intelligent task routing layer (TaskRouter).
 * Coordinates local command execution, offline templates, memory fetching,
 * and determines whether Gemini reasoning is required.
 */
export async function routeTask(text: string): Promise<RoutedResult> {
  const mm = MemoryManager.getInstance();

  // 1. Check Skill Registry for a deterministic match
  const skillEngine = SkillEngine.getInstance();
  const matchedSkill = skillEngine.findMatchingSkill(text);

  if (matchedSkill) {
    console.log(`[TaskRouter] Deterministic skill match: "${matchedSkill.name}" (ID: ${matchedSkill.id}) bypasses Gemini.`);
    try {
      const skillResult = await matchedSkill.execute(text);
      if (matchedSkill.onSuccess) {
        matchedSkill.onSuccess(skillResult);
      }
      return {
        runLocal: true,
        toolName: skillResult.toolName,
        args: skillResult.args,
        responseText: skillResult.responseText,
        intent: skillResult.intent as IntentType
      };
    } catch (err: any) {
      console.error(`[TaskRouter] Error executing skill "${matchedSkill.id}":`, err);
      if (matchedSkill.onFailure) {
        matchedSkill.onFailure(err);
      }
    }
  }

  const match = detectIntent(text);

  console.log(`[TaskRouter] Classifying query via fallback heuristics: "${text}" -> Intent: ${match.intent} (Confidence: ${match.confidence})`);

  // Handle local intents that can be executed and answered entirely locally (sub-100ms)
  switch (match.intent) {
    case "Power Control": {
      const action = match.args?.action || "sleep";
      return {
        runLocal: true,
        toolName: "controlPower",
        args: match.args,
        responseText: `Executing power command: ${action}. I will lock, sleep, or safely power down the workspace.`,
        intent: match.intent
      };
    }

    case "Open App": {
      const appName = match.args?.appName || "Notepad";
      return {
        runLocal: true,
        toolName: "controlApplication",
        args: { action: "open", appName },
        responseText: `Starting ${appName} for you right away. Bringing it to the foreground...`,
        intent: match.intent
      };
    }

    case "Close App": {
      const appName = match.args?.appName || "Notepad";
      return {
        runLocal: true,
        toolName: "controlApplication",
        args: { action: "close", appName },
        responseText: `Safely closing ${appName}. Terminating process...`,
        intent: match.intent
      };
    }

    case "Volume": {
      const value = match.args?.value ?? 50;
      return {
        runLocal: true,
        toolName: "desktopAutomation",
        args: { action: "volume", value },
        responseText: `Setting system volume to ${value} percent.`,
        intent: match.intent
      };
    }

    case "Brightness": {
      const value = match.args?.value ?? 50;
      return {
        runLocal: true,
        toolName: "desktopAutomation",
        args: { action: "brightness", value },
        responseText: `Setting screen brightness to ${value} percent.`,
        intent: match.intent
      };
    }

    case "Clipboard": {
      const { action, text: clipText } = match.args || {};
      if (action === "copyText") {
        return {
          runLocal: true,
          toolName: "manageClipboard",
          args: { action: "copyText", text: clipText },
          responseText: `Copying "${clipText.length > 30 ? clipText.substring(0, 30) + "..." : clipText}" to your clipboard.`,
          intent: match.intent
        };
      } else {
        return {
          runLocal: true,
          toolName: "manageClipboard",
          args: { action: "read" },
          responseText: "Reading system clipboard contents.",
          intent: match.intent
        };
      }
    }

    case "Search File": {
      const query = match.args?.query || "";
      return {
        runLocal: true,
        toolName: "searchFiles",
        args: match.args,
        responseText: `Searching local disk index for files matching "${query}"...`,
        intent: match.intent
      };
    }

    case "Create Folder": {
      return {
        runLocal: true,
        toolName: "manageFolder",
        args: match.args,
        responseText: `Creating directory: ${match.args?.sourcePath}...`,
        intent: match.intent
      };
    }

    case "Create File": {
      return {
        runLocal: true,
        toolName: "manageFile",
        args: match.args,
        responseText: `Writing new file: ${match.args?.sourcePath}...`,
        intent: match.intent
      };
    }

    case "Delete File": {
      return {
        runLocal: true,
        toolName: "manageFile",
        args: match.args,
        responseText: `Deleting item: ${match.args?.sourcePath}...`,
        intent: match.intent
      };
    }

    case "Browser": {
      const { action, url } = match.args || {};
      if (action === "openWebsite") {
        return {
          runLocal: true,
          toolName: "openWebsite",
          args: { url },
          responseText: `Navigating browser to: ${url}. Opening tab...`,
          intent: match.intent
        };
      }
      return {
        runLocal: true,
        toolName: "browserNavigation",
        args: { action },
        responseText: `Triggering browser navigation action: ${action}.`,
        intent: match.intent
      };
    }

    case "Web Search": {
      const query = match.args?.query || text;
      const { spokenConfirmation } = optimizeQueryAndDestination(query);
      return {
        runLocal: true,
        toolName: "searchWeb",
        args: { query },
        responseText: spokenConfirmation,
        intent: match.intent
      };
    }

    case "Settings": {
      return {
        runLocal: true,
        toolName: "desktopAutomation",
        args: { action: "settings" },
        responseText: "Opening the settings control panel HUD.",
        intent: match.intent
      };
    }

    case "System Information": {
      const platform = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";
      const cpus = os.cpus();
      const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : "AMD Ryzen Core";
      const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
      const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
      const systemInfoMsg = `💻 System Diagnostics Summary:\n• Operating System: ${platform} (${process.arch})\n• Processor: ${cpuModel}\n• System Memory: ${freeMem} GB free / ${totalMem} GB total\n• Node Runtime: ${process.version}`;

      return {
        runLocal: true,
        responseText: systemInfoMsg,
        intent: match.intent
      };
    }

    case "Math": {
      const expr = text.replace(/calculate|eval|evaluate|plus|minus|multiplied by|divided by/gi, "");
      const sanitized = expr.replace(/[^0-9+\-*/\s().]/g, "").trim();
      try {
        if (sanitized) {
          const answer = new Function(`return (${sanitized})`)();
          if (typeof answer === "number" && !isNaN(answer)) {
            return {
              runLocal: true,
              responseText: `📊 Math Calculation:\nEquation: ${sanitized}\nResult: **${answer}**`,
              intent: match.intent
            };
          }
        }
      } catch (_) {}
      break; // Fallback to Gemini if complex math string
    }

    case "Task": {
      const { action, title } = match.args || {};
      if (action === "list") {
        try {
          const tasks = mm.getAllTasks();
          if (tasks.length === 0) {
            return {
              runLocal: true,
              responseText: "📋 Task Checklist:\nYou currently have no active or pending tasks. Ask me to add one anytime!",
              intent: match.intent
            };
          }
          const listStr = tasks.map((t, i) => `${i + 1}. [${t.status === "completed" ? "✓" : " "}] **${t.title}** ${t.project ? `(${t.project})` : ""}`).join("\n");
          return {
            runLocal: true,
            responseText: `📋 Active Task Checklist:\n${listStr}`,
            intent: match.intent
          };
        } catch (_) {}
      } else if (action === "create" && title) {
        try {
          const taskId = "task_" + Math.random().toString(36).substring(2, 9);
          mm.saveTask(taskId, title, "pending", "Added via offline Task Router", "General");
          return {
            runLocal: true,
            responseText: `✓ I've added "**${title}**" to your task checklist under general projects.`,
            intent: match.intent
          };
        } catch (_) {}
      }
      break;
    }

    case "Resume Project": {
      try {
        const pmm = ProjectMemoryManager.getInstance();
        const activeProjId = mm.getSetting("active_project_id", process.cwd());
        const proj = pmm.detectAndLoadProject(activeProjId);
        
        const summaryMsg = `📂 Resuming your project workspace: **${proj.name}**
• Folder: \`${proj.folder}\`
• Language: **${proj.language}** | Framework: **${proj.framework}**
• Goals: ${proj.goals.join(", ")}
• Architecture: ${proj.architecture}

🔍 Summary of Last Session:
${proj.recentConversations.length > 0 ? proj.recentConversations[0] : "Ready to jump in! No active logs found from last session."}

✅ Completed Features:
${proj.completedFeatures.length > 0 ? proj.completedFeatures.map(f => `- ${f}`).join("\n") : "- Setup project structure"}

🐛 Known Bugs / Pending Tasks:
${proj.knownBugs.length > 0 ? proj.knownBugs.map(b => `- [Bug] ${b}`).join("\n") : ""}
${proj.pendingTasks.length > 0 ? proj.pendingTasks.map(t => `- [Task] ${t}`).join("\n") : "- None"}

💡 Suggestion for Next Step:
"Let's look at ${proj.importantFiles.length > 0 ? proj.importantFiles[0] : "your main files"} and continue building!"`;

        return {
          runLocal: true,
          responseText: summaryMsg,
          intent: match.intent
        };
      } catch (err: any) {
        console.error("[TaskRouter] Error loading project for resume:", err);
      }
      break;
    }

    case "Memory Search": {
      return {
        runLocal: false,
        responseText: "",
        intent: match.intent
      };
    }
  }

  // If the query benefits from search/recent real-time grounding, route to searchWeb tool locally
  if (checkIfBenefitsFromSearch(text)) {
    console.log(`[TaskRouter] Query "${text}" benefits from search, routing to local searchWeb tool`);
    const { spokenConfirmation } = optimizeQueryAndDestination(text);
    return {
      runLocal: true,
      toolName: "searchWeb",
      args: { query: text },
      responseText: spokenConfirmation,
      intent: "Web Search"
    };
  }

  // If match.intent is reasoning/coding or could not be handled locally, require Gemini reasoning
  return {
    runLocal: false,
    responseText: "",
    intent: match.intent
  };
}
