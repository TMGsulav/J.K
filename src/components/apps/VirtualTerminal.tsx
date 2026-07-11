import React, { useState, useRef, useEffect } from "react";
import { Terminal, Shield } from "lucide-react";

interface CommandLog {
  text: string;
  type: "input" | "output" | "error" | "info";
}

interface VirtualTerminalProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
}

export default function VirtualTerminal({ onAddLog, theme }: VirtualTerminalProps) {
  const [history, setHistory] = useState<CommandLog[]>([
    { text: "Liya Terminal Core [Version 1.1.0]", type: "info" },
    { text: "(c) 2026 Antigravity Corp. All rights reserved.", type: "info" },
    { text: "Type 'help' to view available system commands.", type: "output" }
  ]);
  const [input, setInput] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmdStr = input.trim();
    if (!cmdStr) return;

    const parts = cmdStr.toLowerCase().split(" ");
    const primary = parts[0];
    const args = parts.slice(1);

    const newLogs: CommandLog[] = [...history, { text: `C:\\Liya\\Workspace> ${cmdStr}`, type: "input" }];

    switch (primary) {
      case "help":
        newLogs.push({ text: "Available CLI Commands:", type: "info" });
        newLogs.push({ text: "  help         - Lists active CLI commands and definitions", type: "output" });
        newLogs.push({ text: "  clear        - Clears the terminal screen buffer", type: "output" });
        newLogs.push({ text: "  ls           - List folders and structures in virtual workspace", type: "output" });
        newLogs.push({ text: "  neofetch     - Displays system logo, theme, model, and OS specifications", type: "output" });
        newLogs.push({ text: "  ping [host]  - Measures network latency round-trip duration", type: "output" });
        newLogs.push({ text: "  diagnostics  - Executes real-time diagnostic checks on audio and WS pipelines", type: "output" });
        newLogs.push({ text: "  systeminfo   - Displays underlying hypervisor host specs", type: "output" });
        break;

      case "clear":
        setHistory([]);
        setInput("");
        return;

      case "ls":
        newLogs.push({ text: "Directory: C:\\Liya\\Workspace\\", type: "info" });
        newLogs.push({ text: "  06/28/2026  10:25 AM    <DIR>          Documents", type: "output" });
        newLogs.push({ text: "  06/28/2026  10:25 AM    <DIR>          Downloads", type: "output" });
        newLogs.push({ text: "  06/28/2026  10:25 AM    <DIR>          Pictures", type: "output" });
        newLogs.push({ text: "  06/28/2026  10:25 AM    <DIR>          System", type: "output" });
        newLogs.push({ text: "  06/28/2026  10:25 AM               717 types.ts", type: "output" });
        newLogs.push({ text: "  06/28/2026  10:25 AM            26,012 useLiya.ts", type: "output" });
        break;

      case "neofetch":
        newLogs.push({
          text: `
     /\\_/\\      Liya OS v1.1.0 (WebSandbox64)
    ( o.o )     Host: Cloud Run Container Ingress
     > ^ <      Kernel: Antigravity Micro-VM Kernel
    /     \\     Shell: Liya_OS_PowerShell_v5
   (  |||  )    Uptime: 2 hours, 14 mins
    \\_|||_/     Theme: Immersive Dark (JetBrains Mono)
                Resolution: 1920x1080 (Responsive Stage)
                AI Core: Gemini 3.1 Flash Live (Streamed)
                Web Socket: Active (16kHz Capture, 24kHz Out)`,
          type: "output"
        });
        break;

      case "ping":
        const host = args[0] || "google.com";
        newLogs.push({ text: `Pinging ${host} with 32 bytes of diagnostic data:`, type: "info" });
        newLogs.push({ text: `  Reply from ${host}: bytes=32 time=14ms TTL=54`, type: "output" });
        newLogs.push({ text: `  Reply from ${host}: bytes=32 time=12ms TTL=54`, type: "output" });
        newLogs.push({ text: `  Reply from ${host}: bytes=32 time=15ms TTL=54`, type: "output" });
        newLogs.push({ text: `Ping statistics for ${host}:`, type: "info" });
        newLogs.push({ text: "  Packets: Sent = 3, Received = 3, Lost = 0 (0% loss),", type: "output" });
        newLogs.push({ text: "  Approximate round trip times in milli-seconds: Minimum = 12ms, Maximum = 15ms, Average = 13ms", type: "output" });
        break;

      case "diagnostics":
        newLogs.push({ text: "Starting system-wide pipeline diagnostics...", type: "info" });
        newLogs.push({ text: "  [OK] Ingress WebSocket linked successfully (ReadyState: OPEN)", type: "output" });
        newLogs.push({ text: "  [OK] AudioContext microphone session initialized (16000Hz PCM)", type: "output" });
        newLogs.push({ text: "  [OK] AudioContext playback scheduler active (24000Hz F32 PCM)", type: "output" });
        newLogs.push({ text: "  [OK] Sub-10ms API route handshake checks completed", type: "output" });
        newLogs.push({ text: "All diagnostic probes returned successful response bounds.", type: "info" });
        break;

      case "systeminfo":
        newLogs.push({ text: "Host Name:                 LIYA-CONTAINER-VM", type: "output" });
        newLogs.push({ text: "OS Name:                   Liya OS Hypervisor", type: "output" });
        newLogs.push({ text: "OS Version:                1.1.0 Build 2026", type: "output" });
        newLogs.push({ text: "System Boot Time:          06/28/2026, 06:17:13 AM", type: "output" });
        newLogs.push({ text: "System Manufacturer:       Google AI Studio Build", type: "output" });
        newLogs.push({ text: "Virtual Memory Max Size:   2,048 MB (Allocated limit)", type: "output" });
        break;

      default:
        newLogs.push({ text: `Error: Command '${primary}' is unrecognized. Type 'help' for available options.`, type: "error" });
        break;
    }

    setHistory(newLogs);
    setInput("");
    onAddLog("system", `[Terminal] Executed shell command: ${primary}`);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-[#090b10] border border-slate-800 text-slate-300 font-mono text-[11px] p-4 overflow-hidden select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
        <div className="flex items-center space-x-2 text-indigo-400">
          <Terminal className="w-4 h-4" />
          <span className="font-bold text-xs uppercase tracking-wider">Command Prompt</span>
        </div>
        <div className="flex items-center gap-1 bg-[#1a1c23] border border-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[9px] font-bold">
          <Shield className="w-3 h-3 fill-indigo-400/10" />
          <span>ADMIN RIGHTS</span>
        </div>
      </div>

      {/* Screen Buffer */}
      <div ref={containerRef} className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none pr-1 mb-2 leading-relaxed">
        {history.map((log, idx) => {
          let color = "text-slate-300";
          if (log.type === "input") color = "text-indigo-400 font-bold";
          else if (log.type === "error") color = "text-red-400 font-semibold";
          else if (log.type === "info") color = "text-cyan-400 font-semibold";
          return (
            <pre key={idx} className={`whitespace-pre-wrap ${color}`}>
              {log.text}
            </pre>
          );
        })}
      </div>

      {/* Input Prompt */}
      <form onSubmit={handleCommand} className="flex items-center gap-1 bg-black/40 border border-slate-900 rounded-xl px-3 py-2 text-indigo-400 font-bold">
        <span>C:\Liya\Workspace&gt;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-slate-300 font-mono text-[11px] p-0"
          autoFocus
        />
      </form>
    </div>
  );
}
