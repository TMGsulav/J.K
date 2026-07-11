export type IntentType =
  | "Open App"
  | "Close App"
  | "Search File"
  | "Create Folder"
  | "Create File"
  | "Delete File"
  | "Rename File"
  | "Move File"
  | "Clipboard"
  | "Power Control"
  | "Volume"
  | "Brightness"
  | "Browser"
  | "Web Search"
  | "Reminder"
  | "Task"
  | "System Information"
  | "Automation"
  | "Settings"
  | "Translation"
  | "Math"
  | "Conversation"
  | "Question"
  | "Coding"
  | "Reasoning"
  | "Resume Project"
  | "Memory Search";

export interface IntentMatch {
  intent: IntentType;
  confidence: number; // 0 to 1
  args?: any;
}

/**
 * Highly optimized, local, sub-1ms intent classifier using heuristic keyword and regex mapping.
 * Bypasses Gemini for all system controls, file operations, automation, volume/brightness, and simple tools.
 */
export function detectIntent(text: string): IntentMatch {
  const query = text.trim().toLowerCase();
  if (!query) {
    return { intent: "Conversation", confidence: 1.0 };
  }

  // Helper to extract argument after a match
  const extractTarget = (phrase: string, input: string): string => {
    const index = input.indexOf(phrase);
    if (index === -1) return "";
    return input.substring(index + phrase.length).trim();
  };

  // 1. Power Control
  if (/\b(shutdown|shut down|reboot|restart|sleep|lock|logout|log out|hibernate)\b/i.test(query)) {
    let action: any = "sleep";
    if (query.includes("shutdown") || query.includes("shut down")) action = "shutdown";
    else if (query.includes("reboot") || query.includes("restart")) action = "restart";
    else if (query.includes("lock")) action = "lock";
    else if (query.includes("logout") || query.includes("log out")) action = "logout";
    else if (query.includes("hibernate")) action = "hibernate";

    return {
      intent: "Power Control",
      confidence: 1.0,
      args: { action }
    };
  }

  // 2. Open App / Close App
  const openAppKeywords = ["open", "launch", "start", "run", "execute"];
  const closeAppKeywords = ["close", "quit", "exit", "terminate", "kill"];

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

  for (const kw of openAppKeywords) {
    if (query.startsWith(kw + " ")) {
      const target = query.substring(kw.length + 1).trim();
      // Look for known apps
      for (const [appKey, appName] of Object.entries(appMap)) {
        if (target === appKey || target.includes(appKey)) {
          return {
            intent: "Open App",
            confidence: 0.95,
            args: { action: "open", appName }
          };
        }
      }
      // If not in prebuilt map, return the capitalized raw target as candidate
      return {
        intent: "Open App",
        confidence: 0.9,
        args: {
          action: "open",
          appName: target.charAt(0).toUpperCase() + target.slice(1)
        }
      };
    }
  }

  for (const kw of closeAppKeywords) {
    if (query.startsWith(kw + " ")) {
      const target = query.substring(kw.length + 1).trim();
      for (const [appKey, appName] of Object.entries(appMap)) {
        if (target === appKey || target.includes(appKey)) {
          return {
            intent: "Close App",
            confidence: 0.95,
            args: { action: "close", appName }
          };
        }
      }
      return {
        intent: "Close App",
        confidence: 0.9,
        args: {
          action: "close",
          appName: target.charAt(0).toUpperCase() + target.slice(1)
        }
      };
    }
  }

  // 3. Volume Adjustment
  if (/\b(volume|sound|mute|unmute|louder|quieter|audio)\b/i.test(query)) {
    const numMatch = query.match(/\d+/);
    const value = numMatch ? parseInt(numMatch[0]) : 50;
    let action = "volume";
    if (query.includes("mute")) {
      action = "volume";
      return { intent: "Volume", confidence: 0.95, args: { action, value: 0 } };
    }
    return {
      intent: "Volume",
      confidence: 0.9,
      args: { action, value }
    };
  }

  // 4. Brightness Adjustment
  if (/\b(brightness|screen light|dimmer|brighter|dim|brighten)\b/i.test(query)) {
    const numMatch = query.match(/\d+/);
    const value = numMatch ? parseInt(numMatch[0]) : 50;
    return {
      intent: "Brightness",
      confidence: 0.9,
      args: { action: "brightness", value }
    };
  }

  // 5. Clipboard Operations
  if (/\b(clipboard|copy to|copy that|read clipboard|get clipboard|paste)\b/i.test(query)) {
    let action: "read" | "copyText" | "replace" = "read";
    let text = "";

    if (query.includes("copy") || query.includes("write")) {
      action = "copyText";
      text = extractTarget("copy", query) || extractTarget("write", query);
    } else if (query.includes("paste") || query.includes("read") || query.includes("get")) {
      action = "read";
    }

    return {
      intent: "Clipboard",
      confidence: 0.95,
      args: { action, text }
    };
  }

  // 6. File & Folder Operations
  // Search File
  if (/\b(find file|search file|locate file|lookup file|find files)\b/i.test(query)) {
    const pattern = extractTarget("file", query) || extractTarget("files", query) || "document";
    return {
      intent: "Search File",
      confidence: 0.95,
      args: { query: pattern, searchType: "file" }
    };
  }

  // Create File / Folder
  if (/\b(create file|new file|write file|make file|touch file)\b/i.test(query)) {
    const filename = query.match(/\w+\.\w+/) ? query.match(/\w+\.\w+/)?.[0] : "new_file.txt";
    return {
      intent: "Create File",
      confidence: 0.95,
      args: { action: "create", sourcePath: filename, content: "Created by Liya AI locally." }
    };
  }

  if (/\b(create folder|new folder|mkdir|make folder|create directory|new directory)\b/i.test(query)) {
    const folderName = extractTarget("folder", query) || extractTarget("directory", query) || "New Folder";
    return {
      intent: "Create Folder",
      confidence: 0.95,
      args: { action: "create", sourcePath: folderName }
    };
  }

  // Delete File / Folder
  if (/\b(delete file|remove file|delete folder|remove folder|rmdir|rm)\b/i.test(query)) {
    const target = extractTarget("file", query) || extractTarget("folder", query) || "";
    return {
      intent: "Delete File",
      confidence: 0.9,
      args: { action: "delete", sourcePath: target }
    };
  }

  // 7. Tasks & Reminders
  if (/\b(add task|create task|todo|remind me to|reminder|new task|list tasks|show tasks)\b/i.test(query)) {
    if (query.includes("list") || query.includes("show")) {
      return {
        intent: "Task",
        confidence: 0.95,
        args: { action: "list" }
      };
    }
    const taskTitle = extractTarget("remind me to", query) || extractTarget("add task", query) || extractTarget("todo", query) || "New Task";
    return {
      intent: "Task",
      confidence: 0.95,
      args: { action: "create", title: taskTitle }
    };
  }

  // 8. System Information
  if (/\b(system info|system information|cpu|memory usage|pc specs|about computer|hardware stats)\b/i.test(query)) {
    return {
      intent: "System Information",
      confidence: 1.0
    };
  }

  // 9. Browser / Navigation Controls
  if (/\b(browser back|go back|go forward|browser forward|refresh page|reload page|go home|browser home)\b/i.test(query)) {
    let action = "refresh";
    if (query.includes("back")) action = "back";
    else if (query.includes("forward")) action = "forward";
    else if (query.includes("home")) action = "home";

    return {
      intent: "Browser",
      confidence: 0.95,
      args: { action }
    };
  }

  if (query.startsWith("open website ") || query.startsWith("go to ")) {
    const url = extractTarget("website", query) || extractTarget("to", query);
    return {
      intent: "Browser",
      confidence: 0.95,
      args: { action: "openWebsite", url }
    };
  }

  // 10. Math Calculations (simple numeric ones)
  if (/^[0-9+\-*/\s().]+$/.test(query) || (/\b(calculate|plus|minus|multiplied|divided|sqrt)\b/i.test(query) && /\d+/.test(query))) {
    return {
      intent: "Math",
      confidence: 0.9
    };
  }

  // 11. Settings HUD Control
  if (/\b(open settings|show settings|settings panel|hud settings)\b/i.test(query)) {
    return {
      intent: "Settings",
      confidence: 1.0,
      args: { action: "settings" }
    };
  }

  // 12. Translation Intent (Explicit translations)
  if (/\b(translate|how do you say|how to say)\b/i.test(query)) {
    return {
      intent: "Translation",
      confidence: 0.8
    };
  }

  // 13. Web Search
  if (/\b(search google|search web|google for|web search for)\b/i.test(query)) {
    const searchQuery = extractTarget("google for", query) || extractTarget("web for", query) || extractTarget("search", query);
    return {
      intent: "Web Search",
      confidence: 0.95,
      args: { query: searchQuery }
    };
  }

  // 14. Resume / Continue Project
  if (/\b(continue my project|resume my project|resume work|continue project|resume project|continue my liya project)\b/i.test(query)) {
    return {
      intent: "Resume Project",
      confidence: 1.0
    };
  }

  // 15. Memory Search (Queries about past activities, bugs, files)
  if (/\b(yesterday|last week|what were we doing|what bug|what feature|which file contains|what did we do|search memory)\b/i.test(query)) {
    return {
      intent: "Memory Search",
      confidence: 0.9
    };
  }

  // Default fallbacks based on trigger words for code, learn, research
  if (/\b(code|function|class|typescript|javascript|python|html|css|bug|compile|error in|binary search|algorithm)\b/i.test(query)) {
    return { intent: "Coding", confidence: 0.85 };
  }

  if (/\b(explain|why does|how does|what is the meaning|reason|teach me|logic)\b/i.test(query)) {
    return { intent: "Reasoning", confidence: 0.8 };
  }

  if (/\b(who is|what is|when did|tell me about|news|weather)\b/i.test(query)) {
    return { intent: "Question", confidence: 0.8 };
  }

  // Default to General Conversation (triggers Gemini reasoning engine)
  return {
    intent: "Conversation",
    confidence: 0.5
  };
}
