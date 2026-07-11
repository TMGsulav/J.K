import { SENSITIVE_TOOLS, isToolDangerous, getToolConfirmationMessage, getToolPermissionCategory } from "./permissions";
import { SystemPermissions } from "../types";

export interface SystemToolResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Executes a local system control or desktop automation tool.
 * Handles permission validation, confirmation states, and dispatches UI-friendly CustomEvents
 * to simulate desktop effects (mouse movement, clicks, window launching, notifications).
 */
export async function runSystemTool(
  name: string,
  args: any,
  permissions: SystemPermissions,
  onRequireConfirmation: (message: string, onConfirm: () => void, onCancel: () => void) => void
): Promise<SystemToolResult> {
  const category = getToolPermissionCategory(name);
  
  // 1. Check Permission Category
  if (!permissions[category]) {
    return {
      success: false,
      message: `Permission denied: The '${category}' permission is disabled in Liya's security settings.`
    };
  }

  // 2. Check Confirmation Required for Dangerous actions
  const needsConfirmation = isToolDangerous(name, args);
  if (needsConfirmation) {
    return new Promise((resolve) => {
      const confirmMsg = getToolConfirmationMessage(name, args);
      onRequireConfirmation(
        confirmMsg,
        async () => {
          try {
            const res = await proceedWithToolExecution(name, args);
            resolve(res);
          } catch (err: any) {
            resolve({ success: false, message: `Tool execution error: ${err.message}` });
          }
        },
        () => {
          resolve({ success: false, message: "Action canceled by user." });
        }
      );
    });
  }

  // 3. Directly proceed for standard/safe tools
  return await proceedWithToolExecution(name, args);
}

async function proceedWithToolExecution(name: string, args: any): Promise<SystemToolResult> {
  console.log(`[Liya SystemTools] Proceeding with: ${name}`, args);

  switch (name) {
    case "controlApplication": {
      const { action, appName } = args;
      // Trigger open or close in Liya OS
      if (action === "open" || action === "restart") {
        window.dispatchEvent(new CustomEvent("liya-open-app", { detail: { appName } }));
        
        // Also call backend launcher for real desktop execution (if local)
        try {
          const res = await fetch("/api/launch-app", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ appName })
          });
          const data = await res.json();
          if (data.requiresDisambiguation) {
            return {
              success: false,
              message: data.message
            };
          }
          if (data.requiresConfirmation) {
            return {
              success: false,
              message: data.message
            };
          }
          if (!data.success) {
            return {
              success: false,
              message: data.message || data.error || `Failed to launch application: ${appName}`
            };
          }
          return {
            success: true,
            message: `App '${appName}' launched successfully: ${data.message}`
          };
        } catch (_) {
          return { success: true, message: `App '${appName}' successfully opened in immersive workspace.` };
        }
      } else {
        window.dispatchEvent(new CustomEvent("liya-close-app", { detail: { appName } }));
        return { success: true, message: `App '${appName}' successfully closed.` };
      }
    }

    case "manageFile": {
      const { action, sourcePath, destPath, content } = args;
      try {
        const res = await fetch("/api/files/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toolName: "manageFile", action, sourcePath, destPath, content })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            message: data.message || `File operation '${action}' failed on path: ${sourcePath}`,
            error: data.error,
            data: data
          };
        }
        window.dispatchEvent(new CustomEvent("liya-fs-change", {
          detail: { action, type: "file", path: sourcePath, destPath, content }
        }));
        return {
          success: true,
          message: data.message,
          data: data
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Network or backend error during file operation: ${err.message}`
        };
      }
    }

    case "manageFolder": {
      const { action, sourcePath, destPath } = args;
      try {
        const res = await fetch("/api/files/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toolName: "manageFolder", action, sourcePath, destPath })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            message: data.message || `Folder operation '${action}' failed on path: ${sourcePath}`,
            error: data.error,
            data: data
          };
        }
        window.dispatchEvent(new CustomEvent("liya-fs-change", {
          detail: { action, type: "dir", path: sourcePath, destPath }
        }));
        return {
          success: true,
          message: data.message,
          data: data
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Network or backend error during folder operation: ${err.message}`
        };
      }
    }

    case "manageTextFile": {
      const { action, path: filePath, content, targetText } = args;
      try {
        const res = await fetch("/api/files/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toolName: "manageTextFile", action, path: filePath, content, targetText })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            message: data.message || `Text file action '${action}' failed on path: ${filePath}`,
            error: data.error,
            data: data
          };
        }
        window.dispatchEvent(new CustomEvent("liya-fs-change", {
          detail: { action, type: "file", path: filePath, content, targetText }
        }));
        return {
          success: true,
          message: data.message,
          data: data
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Network or backend error during text file operation: ${err.message}`
        };
      }
    }

    case "manageClipboard": {
      const { action, text } = args;
      if (action === "copyText" || action === "replace") {
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
            window.dispatchEvent(new CustomEvent("liya-clipboard-toast", { detail: { text } }));
            return { success: true, message: "Text copied to system clipboard successfully." };
          } catch (err: any) {
            console.warn("[Clipboard] Native writeText failed, attempting secondary textarea fallback:", err);
            try {
              const textArea = document.createElement("textarea");
              textArea.value = text;
              textArea.style.position = "fixed";
              textArea.style.left = "-999999px";
              textArea.style.top = "-999999px";
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              const successful = document.execCommand("copy");
              textArea.remove();
              if (successful) {
                window.dispatchEvent(new CustomEvent("liya-clipboard-toast", { detail: { text } }));
                return { success: true, message: "Text copied to clipboard via fallback." };
              }
            } catch (fallbackErr) {
              console.warn("[Clipboard] Secondary fallback failed as well:", fallbackErr);
            }
            // If all clipboard writes fail (due to iframe/focus constraints), we write to a virtual buffer and notify the user
            (window as any).__liya_virtual_clipboard = text;
            window.dispatchEvent(new CustomEvent("liya-clipboard-toast", { detail: { text, virtual: true } }));
            return { 
              success: true, 
              message: "Text copied to virtual clipboard buffer. (Click on the application to grant focus for native clipboard)." 
            };
          }
        }
      } else if (action === "read") {
        try {
          const clipboardText = await navigator.clipboard.readText();
          return { success: true, message: "Clipboard read successful.", data: { text: clipboardText } };
        } catch (_) {
          const virtualText = (window as any).__liya_virtual_clipboard || "Liya's clipboard buffer data";
          return { success: true, message: "Read clipboard virtually.", data: { text: virtualText } };
        }
      }
      return { success: true, message: "Clipboard action executed." };
    }

    case "searchFiles": {
      const { query, searchType, extension } = args;
      try {
        const res = await fetch("/api/files/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, searchType, extension })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            success: false,
            message: data.message || `Failed file search for "${query}"`,
            error: data.error
          };
        }
        return {
          success: true,
          message: data.message,
          data: {
            results: data.results || []
          }
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Network or backend error during file search: ${err.message}`
        };
      }
    }

    case "controlPower": {
      const { action } = args;
      window.dispatchEvent(new CustomEvent("liya-system-power", { detail: { action } }));
      
      // Let's call server-side power API if local
      try {
        await fetch("/api/system-power", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });
      } catch (_) {}

      return {
        success: true,
        message: `System power command '${action}' dispatched. Simulated shutdown/restart on Cloud container.`
      };
    }

    case "desktopAutomation": {
      const { action, x, y, text, key, value } = args;
      
      // Emit desktop automation effect for the visual mouse/pointer overlay
      window.dispatchEvent(new CustomEvent("liya-automation-effect", {
        detail: { action, x, y, text, key, value }
      }));

      // Map volume/brightness adjustments to sound effects or settings UI
      if (action === "volume" && typeof value === "number") {
        window.dispatchEvent(new CustomEvent("liya-volume-change", { detail: { value } }));
      } else if (action === "brightness" && typeof value === "number") {
        window.dispatchEvent(new CustomEvent("liya-brightness-change", { detail: { value } }));
      }

      return {
        success: true,
        message: `Desktop automation action '${action}' completed successfully.`
      };
    }

    default:
      return {
        success: false,
        message: `Unknown or unhandled tool: ${name}`
      };
  }
}
export { SENSITIVE_TOOLS, isToolDangerous, getToolConfirmationMessage, getToolPermissionCategory };
