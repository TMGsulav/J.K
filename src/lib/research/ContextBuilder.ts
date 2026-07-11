import { MemoryManager } from "./MemoryManager";
import { ProjectMemoryManager } from "./ProjectMemoryManager";
import { WorkspaceManager } from "./WorkspaceManager";
import { TimelineManager } from "./TimelineManager";

export class ContextBuilder {
  private static instance: ContextBuilder;
  private memoryManager = MemoryManager.getInstance();
  private projectMemoryManager = ProjectMemoryManager.getInstance();
  private workspaceManager = WorkspaceManager.getInstance();
  private timelineManager = TimelineManager.getInstance();

  private constructor() {}

  public static getInstance(): ContextBuilder {
    if (!ContextBuilder.instance) {
      ContextBuilder.instance = new ContextBuilder();
    }
    return ContextBuilder.instance;
  }

  /**
   * Compiles the comprehensive system context, representing Liya's active and historical intelligence.
   */
  public buildFullWorkspaceContext(): string {
    const workspaceState = this.workspaceManager.getWorkspaceState();
    
    // Fetch active project if any, or default to current cwd
    const activeProjId = this.memoryManager.getSetting("active_project_id", process.cwd());
    const projectMemory = this.projectMemoryManager.detectAndLoadProject(activeProjId);

    // Fetch the recent chronological timeline
    const timelineFormatted = this.timelineManager.getFormattedTimeline();

    // Fetch long term general memories (profiles, preferences)
    const ltm = this.memoryManager.getAllLongTermMemories();
    const profileMemories = ltm.filter(m => m.category === "profile").map(m => `- ${m.key}: ${m.value}`).join("\n");
    const prefMemories = ltm.filter(m => m.category === "preference").map(m => `- ${m.key}: ${m.value}`).join("\n");

    let context = `# LIYA COGNITIVE WORKSPACE ENVIRONMENT CONTEXT\n`;

    // 1. Current Application & Session Details
    context += `\n## 1. ACTIVE WORKSPACE STATE\n`;
    context += `- **Current Application**: ${workspaceState.currentApplication}\n`;
    context += `- **Active Working Folder**: \`${workspaceState.currentFolder}\`\n`;
    context += `- **VS Code Active**: ${workspaceState.vsCodeWorkspaceActive ? "Yes" : "No"}\n`;
    context += `- **Running Terminal**: \`${workspaceState.runningTerminal}\`\n`;
    context += `- **Recently Modified Files**:\n${workspaceState.recentFiles.map(f => `  - \`${f}\``).join("\n") || "  - None"}\n`;
    context += `- **Open Web Browser Tabs**:\n${workspaceState.openBrowserTabs.map(t => `  - ${t}`).join("\n")}\n`;
    
    if (workspaceState.gitRepository.isGit) {
      context += `- **Git Repository Details**:\n`;
      context += `  - Branch: \`${workspaceState.gitRepository.branch}\`\n`;
      context += `  - Last Commit: \`${workspaceState.gitRepository.lastCommit}\`\n`;
      context += `  - Status Summary: ${workspaceState.gitRepository.statusSummary}\n`;
    }

    // 2. Active Project Profile
    context += `\n## 2. PROJECT PROFILE MEMORY\n`;
    context += `- **Project Name**: ${projectMemory.name}\n`;
    context += `- **Folder Path**: \`${projectMemory.folder}\`\n`;
    context += `- **Languages**: ${projectMemory.language}\n`;
    context += `- **Frameworks/Runtime**: ${projectMemory.framework}\n`;
    context += `- **Architecture Summary**: ${projectMemory.architecture}\n`;
    context += `- **Important Files**:\n${projectMemory.importantFiles.map(f => `  - \`${f}\``).join("\n") || "  - None"}\n`;
    context += `- **Completed Features**:\n${projectMemory.completedFeatures.map(f => `  - ${f}`).join("\n") || "  - None"}\n`;
    context += `- **Pending Tasks/Roadmap**:\n${projectMemory.pendingTasks.map(t => `  - ${t}`).join("\n") || "  - None"}\n`;
    context += `- **Known Bugs/Issues**:\n${projectMemory.knownBugs.map(b => `  - ${b}`).join("\n") || "  - None"}\n`;

    // 3. Chronological Project Timeline
    context += `\n## 3. HISTORIC TIMELINE\n`;
    context += timelineFormatted + "\n";

    // 4. User Preferences & Profiles
    context += `\n## 4. USER PROFILE & PREFERENCES\n`;
    context += `### Profile:\n${profileMemories || "No specific profile facts recorded."}\n`;
    context += `### Preferences:\n${prefMemories || "No custom preferences saved."}\n`;

    return context;
  }
}
