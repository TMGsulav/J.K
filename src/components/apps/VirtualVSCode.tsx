import { useState, useEffect } from "react";
import { Folder, FileCode, Play, Terminal, Circle } from "lucide-react";

interface FileEntry {
  name: string;
  content: string;
  language: string;
}

interface VirtualVSCodeProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
}

const initialFiles: Record<string, FileEntry> = {
  "App.tsx": {
    language: "tsx",
    name: "App.tsx",
    content: `import React from "react";
import LiyaOS from "./components/LiyaOS";
import { useLiya } from "./hooks/useLiya";

export default function App() {
  const { state, logs, connect, disconnect } = useLiya();
  
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-6 py-4 border-b border-white/[0.03]">
        <h1 className="text-sm font-bold tracking-widest font-mono">LIYA SYSTEM PANEL</h1>
      </header>
      <main className="flex-1 p-8">
        <LiyaOS theme="immersive-dark" state={state} logs={logs} />
      </main>
    </div>
  );
}`
  },
  "useLiya.ts": {
    language: "typescript",
    name: "useLiya.ts",
    content: `import { useState, useEffect, useCallback, useRef } from "react";

export function useLiya() {
  const [state, setState] = useState("disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setState("connecting");
    const ws = new WebSocket(\`\${window.location.protocol === "https:" ? "wss:" : "ws:"}//\${window.location.host}/api/live\`);
    wsRef.current = ws;
    ws.onopen = () => setState("listening");
  }, []);

  return { state, connect };
}`
  },
  "server.ts": {
    language: "typescript",
    name: "server.ts",
    content: `import express from "express";
import { createServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.get("/api/health", (req, res) => {
  res.json({ status: "liya_online", delay_ms: 4 });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Liya core streaming on port 3000");
});`
  },
  "metadata.json": {
    language: "json",
    name: "metadata.json",
    content: `{
  "name": "Liya AI Intelligence",
  "description": "Bidirectional voice assistant with multi-window operating space.",
  "requestFramePermissions": ["camera", "microphone"],
  "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
}`
  }
};

export default function VirtualVSCode({ onAddLog, theme }: VirtualVSCodeProps) {
  const [files, setFiles] = useState<Record<string, FileEntry>>(initialFiles);
  const [selectedFileName, setSelectedFileName] = useState<string>("App.tsx");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "vite v5.2.0 ready in 152ms",
    "➜  Local:   http://localhost:3000/",
    "➜  Network: use --host to expose",
    "➜  press h + enter to show help"
  ]);
  const [typingIndex, setTypingIndex] = useState<number>(-1);
  const [incomingCode, setIncomingCode] = useState<string>("");

  const activeFile = files[selectedFileName] || files["App.tsx"];

  // Sync writing code triggers from Liya
  useEffect(() => {
    const handleWriteCode = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { filePath, code } = customEvent.detail;
      onAddLog("system", `[VS Code] Writing code block to ${filePath}...`);
      
      setFiles(prev => ({
        ...prev,
        [filePath]: {
          name: filePath,
          language: filePath.endsWith(".json") ? "json" : filePath.endsWith(".ts") ? "typescript" : "tsx",
          content: code
        }
      }));
      setSelectedFileName(filePath);

      // Simulate compiling on terminal
      setTerminalLogs(prev => [
        ...prev,
        `[HMR] update updating /src/${filePath}`,
        `[vite] hot updated: /src/${filePath}`,
        "✓ bundled successfully (324ms)"
      ]);
    };

    window.addEventListener("liya-write-code", handleWriteCode);
    return () => {
      window.removeEventListener("liya-write-code", handleWriteCode);
    };
  }, [onAddLog]);

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-800 bg-[#1e1e1e] text-slate-300 font-sans select-none">
      {/* Tab Strip / Header */}
      <div className="px-4 py-2.5 bg-[#181818] border-b border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Circle className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
          <span className="font-bold tracking-tight text-white">Visual Studio Code</span>
        </div>
        <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-md text-[10px] font-mono border border-white/[0.03]">
          <Play className="w-3 h-3 text-emerald-500 fill-emerald-500" />
          <span className="text-slate-400">node dev_server.cjs</span>
        </div>
      </div>

      {/* Main split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar explorer */}
        <div className="w-48 bg-[#181818] border-r border-slate-800/80 p-3.5 flex flex-col space-y-4">
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Explorer</div>
          
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              <span>liya-project</span>
            </div>
            
            <div className="pl-3.5 space-y-1">
              {Object.keys(files).map((fName) => {
                const isActive = fName === selectedFileName;
                return (
                  <button
                    key={fName}
                    onClick={() => setSelectedFileName(fName)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs font-mono transition-colors text-left ${
                      isActive ? "bg-white/[0.05] text-white font-semibold" : "text-slate-400 hover:bg-white/[0.02]"
                    }`}
                  >
                    <FileCode className="w-3 h-3 text-cyan-400" />
                    <span className="truncate">{fName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Code editor content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          {/* File Tab */}
          <div className="bg-[#181818] px-4 py-1.5 flex gap-1 border-b border-slate-800/40 text-[11px]">
            <div className="bg-[#1e1e1e] border-t-2 border-blue-500 px-3.5 py-1 rounded-t flex items-center gap-1.5 text-white font-semibold font-mono">
              <FileCode className="w-3 h-3 text-blue-400" />
              <span>{activeFile.name}</span>
            </div>
          </div>

          {/* Active editor view */}
          <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 scrollbar-thin scrollbar-thumb-slate-800">
            <pre className="text-cyan-400">
              {activeFile.content}
            </pre>
          </div>

          {/* Integrated bottom terminal */}
          <div className="h-32 border-t border-slate-800/80 bg-[#151515] p-3 flex flex-col overflow-hidden select-none">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500 border-b border-slate-800/40 pb-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 mt-2 space-y-0.5 leading-tight scrollbar-none">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-blue-500">➜</span>
                  <span className={log.includes("bundled") ? "text-emerald-500" : ""}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
