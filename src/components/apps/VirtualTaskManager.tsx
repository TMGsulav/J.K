import { useState, useEffect } from "react";
import { Activity, ShieldAlert, Cpu, Database, Wifi, Mic, Speaker, Play, Circle } from "lucide-react";

interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: string;
  status: "Running" | "Suspended";
  appName: string;
}

interface VirtualTaskManagerProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
  activeApps: string[];
  onKillApp: (appName: string) => void;
  latencyLogs: number[];
}

export default function VirtualTaskManager({ onAddLog, theme, activeApps, onKillApp, latencyLogs }: VirtualTaskManagerProps) {
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(15).fill(12));
  const [ramHistory, setRamHistory] = useState<number[]>(Array(15).fill(42));
  const [apiStatus, setApiStatus] = useState<{ status: string; latency: number }>({ status: "checking", latency: 0 });

  // Generate real-time activity charts
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuHistory(prev => {
        const nextVal = Math.max(5, Math.min(95, prev[prev.length - 1] + (Math.random() * 16 - 8)));
        return [...prev.slice(1), Math.round(nextVal)];
      });
      setRamHistory(prev => {
        const nextVal = Math.max(30, Math.min(90, prev[prev.length - 1] + (Math.random() * 4 - 2)));
        return [...prev.slice(1), Math.round(nextVal)];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Poll backend health endpoint periodically for diagnostics
  useEffect(() => {
    const checkHealth = async () => {
      const start = performance.now();
      try {
        const res = await fetch("/api/health");
        const duration = Math.round(performance.now() - start);
        if (res.ok) {
          setApiStatus({ status: "Healthy", latency: duration });
        } else {
          setApiStatus({ status: "Degraded", latency: duration });
        }
      } catch {
        setApiStatus({ status: "Offline", latency: 999 });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute process list based on currently active apps
  const getProcessList = (): Process[] => {
    const defaultProcs: Process[] = [
      { pid: 1402, name: "liya_server_daemon.ts", cpu: 1.5, memory: "45 MB", status: "Running", appName: "Server Daemon" },
      { pid: 1488, name: "gemini_live_session.ts", cpu: 4.2, memory: "124 MB", status: "Running", appName: "Gemini API Link" },
      { pid: 1205, name: "audio_decoder_thread.ts", cpu: 0.8, memory: "18 MB", status: "Running", appName: "Audio Thread" }
    ];

    activeApps.forEach((app, idx) => {
      const appNameLower = app.toLowerCase().replace(" ", "_");
      defaultProcs.push({
        pid: 2000 + idx,
        name: `liya_app_${appNameLower}.tsx`,
        cpu: app === "Browser" ? 8.5 : app === "Paint" ? 6.2 : app === "Spotify" ? 3.4 : 1.2,
        memory: app === "Browser" ? "182 MB" : app === "VS Code" ? "210 MB" : "48 MB",
        status: "Running",
        appName: app
      });
    });

    return defaultProcs;
  };

  const procs = getProcessList();

  const handleEndProcess = (appName: string, pid: number) => {
    onKillApp(appName);
    onAddLog("system", `Terminated application context: ${appName} (PID: ${pid})`);
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl overflow-hidden border font-sans select-none ${
      theme === "premium-light" ? "bg-stone-50 border-stone-200 text-stone-800" : "bg-slate-900 border-slate-800 text-slate-200"
    }`}>
      {/* Header */}
      <div className={`px-5 py-3 border-b flex items-center justify-between ${
        theme === "premium-light" ? "bg-stone-100 border-stone-200" : "bg-black/20 border-slate-800/80"
      }`}>
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          <span className={`font-bold tracking-tight text-sm ${theme === "premium-light" ? "text-stone-900" : "text-white"}`}>Task Manager & Diagnostics</span>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-[10px] font-mono tracking-widest font-bold px-2.5 py-1 rounded-md animate-pulse">
          <Circle className="w-2.5 h-2.5 fill-indigo-500 text-indigo-500" />
          <span>REAL-TIME DIAGNOSTIC BUS</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col xl:flex-row gap-6 overflow-y-auto">
        {/* Statistics & Monitors Panel */}
        <div className="flex-1 flex flex-col space-y-5">
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">System Hardware Meters</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU Monitor */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              theme === "premium-light" ? "bg-white border-stone-200" : "bg-[#141822] border-slate-800"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Cpu className="w-4 h-4 text-emerald-500" />
                  <span>CPU Load</span>
                </div>
                <span className="font-mono text-xs font-extrabold text-emerald-500">{cpuHistory[cpuHistory.length - 1]}%</span>
              </div>
              
              {/* Mini Sparkline graph */}
              <div className="h-16 mt-4 flex items-end justify-between gap-1">
                {cpuHistory.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 rounded-sm transition-all"
                    style={{ height: `${val}%` }}
                    title={`Tick ${idx}: ${val}%`}
                  />
                ))}
              </div>
            </div>

            {/* RAM Monitor */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              theme === "premium-light" ? "bg-white border-stone-200" : "bg-[#141822] border-slate-800"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span>Memory Allocated</span>
                </div>
                <span className="font-mono text-xs font-extrabold text-blue-500">{ramHistory[ramHistory.length - 1]}%</span>
              </div>
              
              {/* Mini Sparkline graph */}
              <div className="h-16 mt-4 flex items-end justify-between gap-1">
                {ramHistory.map((val, idx) => (
                  <div
                    key={idx}
                    className="w-full bg-blue-500/20 hover:bg-blue-500/40 rounded-sm transition-all"
                    style={{ height: `${val}%` }}
                    title={`Tick ${idx}: ${val}%`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostic status points */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Health & Ingress Channels</p>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-medium`}>
              <div className={`p-3 rounded-xl border flex items-center gap-2 ${theme === "premium-light" ? "bg-white border-stone-200" : "bg-slate-950/40 border-slate-800"}`}>
                <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[9px] opacity-60 leading-none">API Health</p>
                  <p className="font-bold mt-0.5">{apiStatus.status}</p>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2 ${theme === "premium-light" ? "bg-white border-stone-200" : "bg-slate-950/40 border-slate-800"}`}>
                <Activity className="w-4 h-4 text-cyan-500 shrink-0" />
                <div>
                  <p className="text-[9px] opacity-60 leading-none">API Latency</p>
                  <p className="font-bold mt-0.5">{apiStatus.latency}ms</p>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2 ${theme === "premium-light" ? "bg-white border-stone-200" : "bg-slate-950/40 border-slate-800"}`}>
                <Mic className="w-4 h-4 text-purple-500 shrink-0" />
                <div>
                  <p className="text-[9px] opacity-60 leading-none">Microphone</p>
                  <p className="font-bold mt-0.5">Active (16kHz)</p>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2 ${theme === "premium-light" ? "bg-white border-stone-200" : "bg-slate-950/40 border-slate-800"}`}>
                <Speaker className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-[9px] opacity-60 leading-none">Speaker Out</p>
                  <p className="font-bold mt-0.5">Stream (24kHz)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Process list & termination column */}
        <div className="w-full xl:w-80 shrink-0 flex flex-col space-y-3 border-t xl:border-t-0 xl:border-l border-slate-800/60 pt-4 xl:pt-0 xl:pl-5">
          <p className="text-xs font-bold uppercase tracking-widest opacity-60">Active Process Tree</p>
          
          <div className="space-y-2 overflow-y-auto flex-1 max-h-[220px] xl:max-h-none pr-1">
            {procs.map((proc, idx) => {
              const isSystemProcess = proc.pid < 2000;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors font-medium ${
                    theme === "premium-light"
                      ? "bg-white border-stone-200"
                      : "bg-[#141822] border-slate-800"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <p className={`font-bold font-mono truncate text-[11px] ${theme === "premium-light" ? "text-stone-900" : "text-white"}`}>{proc.name}</p>
                    </div>
                    <div className="flex gap-2.5 mt-1 text-[10px] opacity-60 font-mono font-medium">
                      <span>PID: {proc.pid}</span>
                      <span>CPU: {proc.cpu}%</span>
                      <span>RAM: {proc.memory}</span>
                    </div>
                  </div>

                  {!isSystemProcess && (
                    <button
                      onClick={() => handleEndProcess(proc.appName, proc.pid)}
                      className={`px-2 py-1 rounded-md text-[9px] font-mono font-bold tracking-wider text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors shrink-0 ml-2 uppercase`}
                    >
                      End Task
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
