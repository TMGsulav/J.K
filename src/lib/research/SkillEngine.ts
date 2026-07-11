import os from "os";

export interface Skill {
  id: string;
  name: string;
  aliases: (string | RegExp)[];
  requiredPermissions: string[];
  supportedOS: string[]; // e.g. ["win32", "darwin", "linux", "all"]
  execute: (text: string, args?: any) => Promise<{
    toolName?: string;
    args?: any;
    responseText: string;
    intent: string;
  }>;
  onSuccess?: (result: any) => void;
  onFailure?: (error: any) => void;
}

export class SkillEngine {
  private static instance: SkillEngine;
  private registry: Map<string, Skill> = new Map();

  private constructor() {
    this.registerCoreSkills();
  }

  public static getInstance(): SkillEngine {
    if (!SkillEngine.instance) {
      SkillEngine.instance = new SkillEngine();
    }
    return SkillEngine.instance;
  }

  /**
   * Register a new skill into the centralized Skill Registry
   */
  public registerSkill(skill: Skill) {
    this.registry.set(skill.id, skill);
    console.log(`[SkillEngine] Registered Skill: "${skill.name}" (ID: ${skill.id})`);
  }

  /**
   * Retrieve all registered skills
   */
  public getSkills(): Skill[] {
    return Array.from(this.registry.values());
  }

  /**
   * Matches the user's input text deterministically against registered skills
   */
  public findMatchingSkill(text: string): Skill | null {
    const query = text.trim().toLowerCase();
    if (!query) return null;

    for (const skill of this.registry.values()) {
      for (const alias of skill.aliases) {
        if (typeof alias === "string") {
          if (query.includes(alias.toLowerCase())) {
            return skill;
          }
        } else if (alias instanceof RegExp) {
          if (alias.test(query)) {
            return skill;
          }
        }
      }
    }
    return null;
  }

  /**
   * Public interface to clear and reload core skills for self-repairing scenarios.
   */
  public initializeSkills() {
    this.registry.clear();
    this.registerCoreSkills();
  }

  /**
   * Register all core system/OS and tool skills
   */
  private registerCoreSkills() {
    // 1. Open Browser / New Tab / Open Website
    this.registerSkill({
      id: "open-browser",
      name: "Open Browser / Web Navigation",
      aliases: [
        /\b(open browser|new tab|open new tab|open tab|go to browser|browser back|go back|go forward|browser forward|refresh page|reload page)\b/i,
        /^(go to|open website|visit)\s+/i
      ],
      requiredPermissions: ["browser"],
      supportedOS: ["all"],
      execute: async (text) => {
        const query = text.toLowerCase();
        let action = "refresh";
        let url: string | undefined;

        if (query.includes("back")) action = "back";
        else if (query.includes("forward")) action = "forward";
        else if (query.includes("home")) action = "home";

        // Extract URL if explicitly provided
        const urlMatch = text.match(/(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?/i);
        if (urlMatch) {
          url = urlMatch[0];
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
          }
          return {
            toolName: "openWebsite",
            args: { url },
            responseText: `Navigating browser to: ${url}. Opening new tab in your workspace.`,
            intent: "Browser"
          };
        }

        if (query.includes("new tab") || query.includes("open browser") || query.includes("open tab")) {
          return {
            toolName: "openWebsite",
            args: { url: "https://www.google.com" },
            responseText: "Opening a new browser tab for you. Directing to home page...",
            intent: "Browser"
          };
        }

        return {
          toolName: "browserNavigation",
          args: { action },
          responseText: `Triggering browser navigation action: ${action}.`,
          intent: "Browser"
        };
      }
    });

    // 2. Open Predefined Applications
    this.registerSkill({
      id: "open-application",
      name: "Open/Close Applications",
      aliases: [
        /\b(open|launch|start|run|execute|close|quit|exit|terminate|kill)\s+(notepad|calculator|calc|chrome|browser|vscode|vs code|cursor|spotify|music|explorer|file explorer|terminal|cmd|command|powershell|shell|bash|maps|gmail|github|youtube|calendar)\b/i
      ],
      requiredPermissions: ["system"],
      supportedOS: ["all"],
      execute: async (text) => {
        const query = text.toLowerCase();
        const openAppKeywords = ["open", "launch", "start", "run", "execute"];
        const isClose = !openAppKeywords.some(kw => query.startsWith(kw));

        const appMap: Record<string, string> = {
          notepad: "Notepad",
          calculator: "Calculator",
          calc: "Calculator",
          chrome: "Chrome",
          browser: "Chrome",
          vscode: "VS Code",
          "vs code": "VS Code",
          cursor: "VS Code",
          spotify: "Spotify",
          music: "Spotify",
          explorer: "File Explorer",
          "file explorer": "File Explorer",
          terminal: "Command Prompt",
          cmd: "Command Prompt",
          command: "Command Prompt",
          powershell: "Command Prompt",
          shell: "Command Prompt",
          bash: "Command Prompt",
          maps: "Maps",
          gmail: "Gmail",
          github: "GitHub",
          youtube: "YouTube",
          calendar: "Calendar"
        };

        let appName = "Notepad";
        for (const [key, val] of Object.entries(appMap)) {
          if (query.includes(key)) {
            appName = val;
            break;
          }
        }

        if (isClose) {
          return {
            toolName: "controlApplication",
            args: { action: "close", appName },
            responseText: `Safely closing ${appName}. Terminating process...`,
            intent: "Close App"
          };
        } else {
          return {
            toolName: "controlApplication",
            args: { action: "open", appName },
            responseText: `Starting ${appName} for you right away. Bringing it to the foreground...`,
            intent: "Open App"
          };
        }
      }
    });

    // 3. Create Folder
    this.registerSkill({
      id: "create-folder",
      name: "Create Folder",
      aliases: [
        /\b(create folder|new folder|mkdir|make folder|create directory|new directory)\b/i
      ],
      requiredPermissions: ["filesystem"],
      supportedOS: ["all"],
      execute: async (text) => {
        // Extract folder name or use a default
        const match = text.match(/\b(create folder|new folder|mkdir|make folder|create directory|new directory)\s+(.+)/i);
        const folderName = match ? match[2].trim() : "New Folder";
        return {
          toolName: "manageFolder",
          args: { action: "create", sourcePath: folderName },
          responseText: `Creating directory: ${folderName}...`,
          intent: "Create Folder"
        };
      }
    });

    // 4. Create File
    this.registerSkill({
      id: "create-file",
      name: "Create File",
      aliases: [
        /\b(create file|new file|write file|make file|touch file)\b/i
      ],
      requiredPermissions: ["filesystem"],
      supportedOS: ["all"],
      execute: async (text) => {
        const fileMatch = text.match(/\w+\.\w+/);
        const filename = fileMatch ? fileMatch[0] : "new_file.txt";
        return {
          toolName: "manageFile",
          args: { action: "create", sourcePath: filename, content: "Created by Liya AI locally." },
          responseText: `Writing new file: ${filename}...`,
          intent: "Create File"
        };
      }
    });

    // 5. Delete File / Folder
    this.registerSkill({
      id: "delete-file",
      name: "Delete File / Folder",
      aliases: [
        /\b(delete file|remove file|delete folder|remove folder|rmdir|rm)\b/i
      ],
      requiredPermissions: ["filesystem"],
      supportedOS: ["all"],
      execute: async (text) => {
        const match = text.match(/\b(delete file|remove file|delete folder|remove folder|rmdir|rm)\s+(.+)/i);
        const target = match ? match[2].trim() : "";
        return {
          toolName: "manageFile",
          args: { action: "delete", sourcePath: target },
          responseText: `Deleting item: ${target}...`,
          intent: "Delete File"
        };
      }
    });

    // 6. Rename/Move File
    this.registerSkill({
      id: "rename-file",
      name: "Rename or Move File",
      aliases: [
        /\b(rename file|move file|rename\s+(.*)\s+to\s+(.*))\b/i
      ],
      requiredPermissions: ["filesystem"],
      supportedOS: ["all"],
      execute: async (text) => {
        const match = text.match(/rename\s+(.+)\s+to\s+(.+)/i) || text.match(/move\s+(.+)\s+to\s+(.+)/i);
        let sourcePath = "source.txt";
        let destPath = "destination.txt";

        if (match) {
          sourcePath = match[1].trim();
          destPath = match[2].trim();
        }

        return {
          toolName: "manageFile",
          args: { action: "rename", sourcePath, destPath },
          responseText: `Renaming file from ${sourcePath} to ${destPath}...`,
          intent: "Rename File"
        };
      }
    });

    // 7. Clipboard Operations (Copy & Paste)
    this.registerSkill({
      id: "clipboard",
      name: "Clipboard Operations",
      aliases: [
        /\b(clipboard|copy to|copy that|read clipboard|get clipboard|paste|copy\s+.*)\b/i
      ],
      requiredPermissions: ["system"],
      supportedOS: ["all"],
      execute: async (text) => {
        const query = text.toLowerCase();
        if (query.includes("paste") || query.includes("read") || query.includes("get")) {
          return {
            toolName: "manageClipboard",
            args: { action: "read" },
            responseText: "Reading system clipboard contents.",
            intent: "Clipboard"
          };
        } else {
          // Extract text to copy
          const match = text.match(/copy\s+(.+?)(\s+to clipboard)?$/i) || text.match(/write\s+(.+?)(\s+to clipboard)?$/i);
          const clipText = match ? match[1].trim() : text;
          return {
            toolName: "manageClipboard",
            args: { action: "copyText", text: clipText },
            responseText: `Copying "${clipText.length > 30 ? clipText.substring(0, 30) + "..." : clipText}" to your clipboard.`,
            intent: "Clipboard"
          };
        }
      }
    });

    // 8. Screenshot Captures
    this.registerSkill({
      id: "screenshot",
      name: "Take Screenshot",
      aliases: [
        /\b(take screenshot|screenshot|capture screen|print screen|grab screen)\b/i
      ],
      requiredPermissions: ["system"],
      supportedOS: ["all"],
      execute: async () => {
        return {
          toolName: "desktopAutomation",
          args: { action: "screenshot" },
          responseText: "Capturing your current screen visual. Smile!",
          intent: "Screenshot"
        };
      }
    });

    // 9. Window Management
    this.registerSkill({
      id: "window-management",
      name: "Window Management",
      aliases: [
        /\b(minimize|maximize|close window|move window|tile windows)\b/i
      ],
      requiredPermissions: ["system"],
      supportedOS: ["all"],
      execute: async (text) => {
        const query = text.toLowerCase();
        let action = "minimize";
        if (query.includes("maximize")) action = "maximize";
        else if (query.includes("close")) action = "close";
        else if (query.includes("move")) action = "move";
        else if (query.includes("tile")) action = "tile";

        return {
          toolName: "desktopAutomation",
          args: { action: "window", subAction: action },
          responseText: `Executing window control command: ${action} active window.`,
          intent: "Window Management"
        };
      }
    });

    // 10. System Information & Utilities (Volume, Brightness, Power)
    this.registerSkill({
      id: "system-utilities",
      name: "System Utilities",
      aliases: [
        /\b(system info|system information|cpu|memory usage|pc specs|about computer|hardware stats|volume|sound|mute|unmute|louder|quieter|audio|brightness|screen light|dimmer|brighter|dim|brighten|shutdown|shut down|reboot|restart|sleep|lock|logout|log out|hibernate)\b/i
      ],
      requiredPermissions: ["system"],
      supportedOS: ["all"],
      execute: async (text) => {
        const query = text.toLowerCase();

        // Power control
        if (/\b(shutdown|shut down|reboot|restart|sleep|lock|logout|log out|hibernate)\b/i.test(query)) {
          let powerAction = "sleep";
          if (query.includes("shutdown") || query.includes("shut down")) powerAction = "shutdown";
          else if (query.includes("reboot") || query.includes("restart")) powerAction = "restart";
          else if (query.includes("lock")) powerAction = "lock";
          else if (query.includes("logout") || query.includes("log out")) powerAction = "logout";
          else if (query.includes("hibernate")) powerAction = "hibernate";

          return {
            toolName: "controlPower",
            args: { action: powerAction },
            responseText: `Executing power command: ${powerAction}. Locking or safely sleeping the workspace environment.`,
            intent: "Power Control"
          };
        }

        // Volume adjustment
        if (/\b(volume|sound|mute|unmute|louder|quieter|audio)\b/i.test(query)) {
          const numMatch = query.match(/\d+/);
          const value = numMatch ? parseInt(numMatch[0]) : 50;
          let action = "volume";
          if (query.includes("mute")) {
            return {
              toolName: "desktopAutomation",
              args: { action, value: 0 },
              responseText: "Muting system sound levels completely.",
              intent: "Volume"
            };
          }
          return {
            toolName: "desktopAutomation",
            args: { action, value },
            responseText: `Setting system volume to ${value} percent.`,
            intent: "Volume"
          };
        }

        // Brightness adjustment
        if (/\b(brightness|screen light|dimmer|brighter|dim|brighten)\b/i.test(query)) {
          const numMatch = query.match(/\d+/);
          const value = numMatch ? parseInt(numMatch[0]) : 50;
          return {
            toolName: "desktopAutomation",
            args: { action: "brightness", value },
            responseText: `Setting screen brightness to ${value} percent.`,
            intent: "Brightness"
          };
        }

        // System information
        const platform = process.platform === "win32" ? "Windows" : process.platform === "darwin" ? "macOS" : "Linux";
        const cpus = os.cpus();
        const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : "Intel / AMD Core";
        const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
        const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);
        const systemInfoMsg = `💻 System Diagnostics Summary:\n• Operating System: ${platform} (${process.arch})\n• Processor: ${cpuModel}\n• System Memory: ${freeMem} GB free / ${totalMem} GB total\n• Node Runtime: ${process.version}`;

        return {
          responseText: systemInfoMsg,
          intent: "System Information"
        };
      }
    });
  }

  /**
   * Run automatic regression tests to verify that all core skills still function perfectly.
   * If any skill matching breaks, we will log a severe warning or reject updates.
   */
  public async runRegressionTests(): Promise<{ passed: boolean; results: any[] }> {
    console.log("[SkillEngine] Starting automatic regression tests...");
    const testCases = [
      { text: "open browser", expectedSkill: "open-browser" },
      { text: "go to google.com", expectedSkill: "open-browser" },
      { text: "new tab", expectedSkill: "open-browser" },
      { text: "open notepad", expectedSkill: "open-application" },
      { text: "close vscode", expectedSkill: "open-application" },
      { text: "create folder projects", expectedSkill: "create-folder" },
      { text: "create file test.ts", expectedSkill: "create-file" },
      { text: "delete file temp.js", expectedSkill: "delete-file" },
      { text: "rename file data.txt to info.txt", expectedSkill: "rename-file" },
      { text: "copy Hello World", expectedSkill: "clipboard" },
      { text: "paste", expectedSkill: "clipboard" },
      { text: "take screenshot", expectedSkill: "screenshot" },
      { text: "minimize window", expectedSkill: "window-management" },
      { text: "set volume to 80", expectedSkill: "system-utilities" },
      { text: "dim brightness", expectedSkill: "system-utilities" },
      { text: "system information", expectedSkill: "system-utilities" }
    ];

    const results: any[] = [];
    let passed = true;

    for (const test of testCases) {
      const skill = this.findMatchingSkill(test.text);
      if (!skill) {
        console.error(`❌ [Regression] Match Failed for text: "${test.text}". Expected skill: "${test.expectedSkill}"`);
        passed = false;
        results.push({ text: test.text, expected: test.expectedSkill, got: null, status: "failed" });
      } else if (skill.id !== test.expectedSkill) {
        console.error(`❌ [Regression] Incorrect Skill Matched for text: "${test.text}". Expected: "${test.expectedSkill}", Got: "${skill.id}"`);
        passed = false;
        results.push({ text: test.text, expected: test.expectedSkill, got: skill.id, status: "failed" });
      } else {
        try {
          const res = await skill.execute(test.text);
          results.push({ text: test.text, expected: test.expectedSkill, got: skill.id, status: "passed", payload: res });
        } catch (err: any) {
          console.error(`❌ [Regression] Execution crashed for skill: "${skill.id}" under query "${test.text}": ${err.message}`);
          passed = false;
          results.push({ text: test.text, expected: test.expectedSkill, got: skill.id, status: "crashed", error: err.message });
        }
      }
    }

    if (passed) {
      console.log(`✅ [Regression] All ${testCases.length} core regression checks PASSED with 100% success rate!`);
    } else {
      console.warn("⚠️ [Regression] Some core skills failed regression checks!");
    }

    return { passed, results };
  }
}
