export interface ParsedCommand {
  module: string; // e.g. "FileManager", "FolderManager", "ClipboardManager", "WindowManager", "AppManager", "SystemManager", "ScreenshotManager", "SearchManager", "ProcessManager", "TaskManager", "RecycleBinManager"
  action: string;
  args: any;
}

export class IntentParser {
  private static instance: IntentParser;

  private constructor() {}

  public static getInstance(): IntentParser {
    if (!IntentParser.instance) {
      IntentParser.instance = new IntentParser();
    }
    return IntentParser.instance;
  }

  /**
   * Intelligently parses natural language text into a structured command.
   */
  public parse(text: string): ParsedCommand | null {
    if (!text) return null;
    const clean = text.toLowerCase().trim();

    // 1. SCREENSHOTS (ScreenshotManager)
    if (clean.includes("screenshot") || clean.includes("take a picture of the screen") || clean.includes("capture screen")) {
      let type = "entire";
      if (clean.includes("active") || clean.includes("window")) {
        type = "activeWindow";
      } else if (clean.includes("region") || clean.includes("area") || clean.includes("select")) {
        type = "region";
      }
      return {
        module: "ScreenshotManager",
        action: "captureScreenshot",
        args: { type }
      };
    }

    // 2. RECYCLE BIN (RecycleBinManager)
    if (clean.includes("recycle bin") || clean.includes("trash")) {
      if (clean.includes("empty") || clean.includes("clear") || clean.includes("purge")) {
        return {
          module: "RecycleBinManager",
          action: "emptyRecycleBin",
          args: {}
        };
      }
      if (clean.includes("list") || clean.includes("show") || clean.includes("view")) {
        return {
          module: "RecycleBinManager",
          action: "listRecycleBin",
          args: {}
        };
      }
      if (clean.includes("restore") || clean.includes("undelete")) {
        const itemMatch = text.match(/(?:restore|undelete)\s+(?:file\s+)?([^\s\n\r"']+)/i);
        return {
          module: "RecycleBinManager",
          action: "restoreFromRecycleBin",
          args: { name: itemMatch ? itemMatch[1] : "" }
        };
      }
    }

    // 3. SYSTEM CONTROLS (SystemManager)
    if (clean.includes("volume") || clean.includes("mute") || clean.includes("unmute") || clean.includes("sound")) {
      if (clean.includes("mute")) {
        return { module: "SystemManager", action: "setMute", args: { isMuted: true } };
      }
      if (clean.includes("unmute")) {
        return { module: "SystemManager", action: "setMute", args: { isMuted: false } };
      }
      const valMatch = text.match(/(?:set|change|to)\s+volume\s+(?:to\s+)?(\d+)/i) || text.match(/volume\s+(?:to\s+)?(\d+)/i);
      if (valMatch) {
        return { module: "SystemManager", action: "setVolume", args: { value: parseInt(valMatch[1], 10) } };
      }
    }

    if (clean.includes("brightness")) {
      const valMatch = text.match(/(?:set|change|to)\s+brightness\s+(?:to\s+)?(\d+)/i) || text.match(/brightness\s+(?:to\s+)?(\d+)/i);
      if (valMatch) {
        return { module: "SystemManager", action: "setBrightness", args: { value: parseInt(valMatch[1], 10) } };
      }
    }

    if (clean.includes("battery") || clean.includes("power status") || clean.includes("charge")) {
      return { module: "SystemManager", action: "getBatteryInfo", args: {} };
    }

    if (clean.includes("cpu") || clean.includes("ram") || clean.includes("memory usage") || clean.includes("disk usage") || clean.includes("system resources")) {
      return { module: "SystemManager", action: "getSystemResources", args: {} };
    }

    if (clean.includes("ip address") || clean.includes("network info") || clean.includes("my ip") || clean.includes("internet connection")) {
      return { module: "SystemManager", action: "getNetworkInfo", args: {} };
    }

    if (clean.includes("shutdown") || clean.includes("turn off my pc") || clean.includes("power down")) {
      return { module: "SystemManager", action: "shutdown", args: {} };
    }

    if (clean.includes("restart my pc") || clean.includes("reboot computer")) {
      return { module: "SystemManager", action: "restart", args: {} };
    }

    if (clean.includes("sleep mode") || clean.includes("put computer to sleep")) {
      return { module: "SystemManager", action: "sleep", args: {} };
    }

    if (clean.includes("lock computer") || clean.includes("lock my pc") || clean.includes("lock screen")) {
      return { module: "SystemManager", action: "lockPC", args: {} };
    }

    if (clean.includes("sign out") || clean.includes("log out")) {
      return { module: "SystemManager", action: "signOut", args: {} };
    }

    // 4. WINDOW MANAGEMENT (WindowManager)
    if (clean.includes("window") || clean.includes("windows")) {
      if (clean.includes("minimize")) {
        return { module: "WindowManager", action: "minimizeWindow", args: {} };
      }
      if (clean.includes("maximize")) {
        return { module: "WindowManager", action: "maximizeWindow", args: {} };
      }
      if (clean.includes("restore") || clean.includes("unminimize")) {
        return { module: "WindowManager", action: "restoreWindow", args: {} };
      }
      if (clean.includes("close")) {
        return { module: "WindowManager", action: "closeWindow", args: {} };
      }
      if (clean.includes("tile")) {
        return { module: "WindowManager", action: "tileWindows", args: {} };
      }
      if (clean.includes("cascade")) {
        return { module: "WindowManager", action: "cascadeWindows", args: {} };
      }
      if (clean.includes("arrange")) {
        return { module: "WindowManager", action: "arrangeWindows", args: {} };
      }
    }

    // 5. CLIPBOARD (ClipboardManager)
    if (clean.includes("clipboard") || clean.includes("copy to")) {
      if (clean.includes("clear") || clean.includes("empty")) {
        return { module: "ClipboardManager", action: "clearClipboard", args: {} };
      }
      if (clean.includes("read") || clean.includes("get") || clean.includes("what is in")) {
        return { module: "ClipboardManager", action: "readClipboard", args: {} };
      }
      const copyMatch = text.match(/(?:copy|write|set)\s+(".*?"|[^\s\n\r"']+)\s+to\s+clipboard/i);
      if (copyMatch) {
        return { module: "ClipboardManager", action: "writeClipboard", args: { text: copyMatch[1].replace(/"/g, "") } };
      }
    }

    // 6. PROCESS MANAGER (ProcessManager)
    if (clean.includes("process") || clean.includes("running task") || clean.includes("kill task") || clean.includes("terminate")) {
      if (clean.includes("kill") || clean.includes("terminate") || clean.includes("stop")) {
        const processMatch = text.match(/(?:kill|terminate|stop)\s+(?:process\s+)?([^\s\n\r"']+)/i);
        if (processMatch) {
          return { module: "ProcessManager", action: "killProcess", args: { nameOrId: processMatch[1] } };
        }
      }
      if (clean.includes("list") || clean.includes("show") || clean.includes("running")) {
        return { module: "ProcessManager", action: "listProcesses", args: {} };
      }
    }

    // 7. FILE SEARCH (SearchManager)
    if (clean.includes("search") || clean.includes("find file") || clean.includes("find folder")) {
      const searchMatch = text.match(/(?:search|find)\s+(?:my\s+)?(?:desktop|downloads|documents|folder|files)?\s*(?:for\s+)?([^\s\n\r"']+)/i);
      if (searchMatch) {
        let extension = undefined;
        let searchType = "all";
        const queryTerm = searchMatch[1].replace(/"/g, "").trim();
        
        if (queryTerm.includes("python") || queryTerm.includes(".py")) {
          extension = "py";
          searchType = "extension";
        } else if (queryTerm.includes("text") || queryTerm.includes(".txt")) {
          extension = "txt";
          searchType = "extension";
        } else if (clean.includes("folder")) {
          searchType = "folder";
        } else if (clean.includes("file")) {
          searchType = "file";
        }

        return {
          module: "SearchManager",
          action: "searchFiles",
          args: { query: queryTerm, searchType, extension }
        };
      }
    }

    // 8. FOLDER MANAGEMENT (FolderManager)
    if (clean.includes("folder") || clean.includes("directory")) {
      if (clean.includes("create") || clean.includes("make") || clean.includes("new")) {
        const folderMatch = text.match(/(?:create|make|new)\s+(?:folder\s+)?(?:named\s+)?([^\s\n\r"']+)/i);
        if (folderMatch) {
          return {
            module: "FolderManager",
            action: "createFolder",
            args: { path: folderMatch[1].replace(/"/g, "") }
          };
        }
      }
      if (clean.includes("delete") || clean.includes("remove") || clean.includes("destroy")) {
        const folderMatch = text.match(/(?:delete|remove|destroy)\s+(?:folder\s+)?([^\s\n\r"']+)/i);
        if (folderMatch) {
          return {
            module: "FolderManager",
            action: "deleteFolder",
            args: { path: folderMatch[1].replace(/"/g, "") }
          };
        }
      }
      if (clean.includes("rename")) {
        const renameMatch = text.match(/rename\s+(?:folder\s+)?([^\s\n\r"']+)\s+to\s+([^\s\n\r"']+)/i);
        if (renameMatch) {
          return {
            module: "FolderManager",
            action: "renameFolder",
            args: { sourcePath: renameMatch[1].replace(/"/g, ""), newName: renameMatch[2].replace(/"/g, "") }
          };
        }
      }
      if (clean.includes("list") || clean.includes("show contents")) {
        const folderMatch = text.match(/(?:list|show contents of)\s+([^\s\n\r"']+)/i);
        return {
          module: "FolderManager",
          action: "listFolderContents",
          args: { path: folderMatch ? folderMatch[1].replace(/"/g, "") : "Desktop" }
        };
      }
    }

    // 9. FILE MANAGEMENT (FileManager)
    if (clean.includes("file") || clean.includes("text file") || clean.includes("python file") || clean.includes("markdown file") || clean.includes("json file")) {
      // Create operations
      if (clean.includes("create") || clean.includes("make") || clean.includes("write")) {
        const fileMatch = text.match(/(?:create|make|new)\s+(?:file\s+)?(?:named\s+)?([^\s\n\r"']+)/i);
        if (fileMatch) {
          const fileName = fileMatch[1].replace(/"/g, "");
          let action = "createFile";
          if (fileName.endsWith(".py")) action = "createPythonFile";
          else if (fileName.endsWith(".md")) action = "createMarkdownFile";
          else if (fileName.endsWith(".html")) action = "createHtmlFile";
          else if (fileName.endsWith(".json")) action = "createJsonFile";

          return {
            module: "FileManager",
            action,
            args: { path: fileName, content: "" }
          };
        }
      }
      // Delete operations
      if (clean.includes("delete") || clean.includes("remove")) {
        const fileMatch = text.match(/(?:delete|remove)\s+(?:file\s+)?([^\s\n\r"']+)/i);
        if (fileMatch) {
          return {
            module: "FileManager",
            action: "deleteFile",
            args: { path: fileMatch[1].replace(/"/g, "") }
          };
        }
      }
      // Rename operations
      if (clean.includes("rename")) {
        const renameMatch = text.match(/rename\s+(?:file\s+)?([^\s\n\r"']+)\s+to\s+([^\s\n\r"']+)/i);
        if (renameMatch) {
          return {
            module: "FileManager",
            action: "renameFile",
            args: { sourcePath: renameMatch[1].replace(/"/g, ""), newName: renameMatch[2].replace(/"/g, "") }
          };
        }
      }
      // Move operations
      if (clean.includes("move")) {
        const moveMatch = text.match(/move\s+(?:file\s+)?([^\s\n\r"']+)\s+to\s+([^\s\n\r"']+)/i);
        if (moveMatch) {
          return {
            module: "FileManager",
            action: "moveFile",
            args: { sourcePath: moveMatch[1].replace(/"/g, ""), destPath: moveMatch[2].replace(/"/g, "") }
          };
        }
      }
      // Copy / Duplicate operations
      if (clean.includes("copy") || clean.includes("duplicate")) {
        const copyMatch = text.match(/(?:copy|duplicate)\s+(?:file\s+)?([^\s\n\r"']+)\s+to\s+([^\s\n\r"']+)/i) || text.match(/(?:copy|duplicate)\s+(?:file\s+)?([^\s\n\r"']+)/i);
        if (copyMatch) {
          return {
            module: "FileManager",
            action: clean.includes("duplicate") ? "duplicateFile" : "copyFile",
            args: { sourcePath: copyMatch[1].replace(/"/g, ""), destPath: copyMatch[2] ? copyMatch[2].replace(/"/g, "") : "" }
          };
        }
      }
      // Read operations
      if (clean.includes("read") || clean.includes("open") || clean.includes("view")) {
        const fileMatch = text.match(/(?:read|open|view)\s+(?:file\s+)?([^\s\n\r"']+)/i);
        if (fileMatch) {
          return {
            module: "FileManager",
            action: "readFile",
            args: { path: fileMatch[1].replace(/"/g, "") }
          };
        }
      }
    }

    // 10. APP MANAGEMENT (AppManager)
    if (clean.includes("open") || clean.includes("launch") || clean.includes("start")) {
      const appMatch = text.match(/(?:open|launch|start)\s+([^\s\n\r"']+)/i);
      if (appMatch) {
        return {
          module: "AppManager",
          action: "openApplication",
          args: { appName: appMatch[1].replace(/"/g, "") }
        };
      }
    }
    if (clean.includes("close") || clean.includes("quit") || clean.includes("exit")) {
      const appMatch = text.match(/(?:close|quit|exit)\s+([^\s\n\r"']+)/i);
      if (appMatch) {
        return {
          module: "AppManager",
          action: "closeApplication",
          args: { appName: appMatch[1].replace(/"/g, "") }
        };
      }
    }

    return null;
  }
}
