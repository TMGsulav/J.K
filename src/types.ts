export type AssistantState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "thinking"
  | "speaking"
  | "executing_tool"
  | "interrupted"
  | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  sender: "user" | "liya" | "system";
  text: string;
  isToolCall?: boolean;
  toolDetails?: {
    name: string;
    args: any;
    status: "pending" | "success" | "error";
    result?: any;
  };
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

export interface ToolCallPayload {
  id: string;
  name: string;
  args: any;
}

export interface SavedSession {
  id: string;
  timestamp: string;
  title: string;
  logs: LogEntry[];
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
}

export interface OSWindow {
  id: string; // e.g. "browser", "notepad", etc.
  title: string;
  appName: string; // e.g. "Browser", "VS Code", "Notepad", "Calculator", "Paint", "Spotify", "Task Manager", "File Explorer", "Command Prompt", "Settings"
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
}

export interface VirtualFile {
  name: string;
  type: "file" | "dir";
  path: string;
  content?: string;
  children?: VirtualFile[];
}

export interface SystemPermissions {
  filesystem: boolean;
  clipboard: boolean;
  power: boolean;
  browser: boolean;
  automation: boolean;
}

export type SimulatedEmotion =
  | "neutral"
  | "happy"
  | "sad"
  | "thinking"
  | "listening"
  | "excited"
  | "curious"
  | "empathetic"
  | "confident"
  | "disappointed"
  | "encouraging"
  | "celebrating";

export interface ConfirmationRequest {
  id: string;
  toolName: string;
  args: any;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}


