import { SystemPermissions } from "../types";

export const DEFAULT_PERMISSIONS: SystemPermissions = {
  filesystem: true,
  clipboard: true,
  power: true, // Enabled by default; confirmation prompts still protect critical operations
  browser: true,
  automation: true // Enabled by default; confirmation prompts still protect critical operations
};

export const SENSITIVE_TOOLS = [
  "controlPower",
  "desktopAutomation",
  "manageFile",
  "manageFolder",
  "manageTextFile"
];

export function getToolPermissionCategory(toolName: string): keyof SystemPermissions {
  switch (toolName) {
    case "controlPower":
      return "power";
    case "desktopAutomation":
      return "automation";
    case "manageFile":
    case "manageFolder":
    case "manageTextFile":
      return "filesystem";
    case "openWebsite":
    case "browserNavigation":
    case "browserSearch":
      return "browser";
    case "copyToClipboard":
      return "clipboard";
    default:
      return "browser"; // fallback safe category
  }
}

export function isToolDangerous(toolName: string, args: any): boolean {
  if (toolName === "controlPower") return true;
  if (toolName === "desktopAutomation") {
    // Media, volume and brightness are less dangerous, but power/clicks/mouse/shortcuts are dangerous
    const safeActions = ["volume", "brightness", "mediaPlayback"];
    return !safeActions.includes(args.action);
  }
  if (toolName === "manageFile" || toolName === "manageFolder" || toolName === "manageTextFile") {
    // Delete action is dangerous
    return args.action === "delete";
  }
  return false;
}

export function getToolConfirmationMessage(toolName: string, args: any): string {
  switch (toolName) {
    case "controlPower":
      return `Are you sure you want to let Liya ${args.action} your computer?`;
    case "desktopAutomation":
      if (args.action === "pressShortcut") {
        return `Let Liya trigger the system shortcut: ${args.key}?`;
      }
      return `Allow Liya to execute desktop automation action: ${args.action}?`;
    case "manageFile":
    case "manageTextFile":
      if (args.action === "delete") {
        return `Confirm deletion of file: ${args.sourcePath || args.path}?`;
      }
      return `Allow Liya to ${args.action} the file: ${args.sourcePath || args.path}?`;
    case "manageFolder":
      if (args.action === "delete") {
        return `Confirm deletion of folder: ${args.sourcePath}?`;
      }
      return `Allow Liya to ${args.action} the folder: ${args.sourcePath}?`;
    default:
      return `Confirm execution of tool ${toolName}?`;
  }
}
