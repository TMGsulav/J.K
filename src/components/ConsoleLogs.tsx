import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, Cpu, Clock, CheckCircle, AlertTriangle, Play, HelpCircle, ArrowRight } from "lucide-react";
import { LogEntry } from "../types";

interface ConsoleLogsProps {
  logs: LogEntry[];
  transcription: { user: string; liya: string };
  currentState: string;
  theme?: "immersive-dark" | "premium-light";
}

export const ConsoleLogs: React.FC<ConsoleLogsProps> = ({
  logs,
  transcription,
  currentState,
  theme = "immersive-dark",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top (logs are unshifted, so new logs appear at the top)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs, transcription]);

  return (
    <div id="logs-container" className={`flex flex-col h-full backdrop-blur-md rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300 ${
      theme === "premium-light" 
        ? "bg-stone-50/70 border-stone-200/80 text-stone-800" 
        : "bg-slate-950/40 border-slate-800/60 text-slate-100"
    }`}>
      {/* Console Header */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b transition-all duration-300 ${
        theme === "premium-light" 
          ? "border-stone-200/60 bg-stone-100/40 text-stone-700" 
          : "border-slate-800/50 bg-slate-900/30 text-slate-300"
      }`}>
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className={`text-xs font-mono font-medium tracking-wider uppercase ${theme === "premium-light" ? "text-stone-700" : "text-slate-300"}`}>Liya HUD Console</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              currentState === "disconnected" ? "bg-slate-500" :
              currentState === "error" ? "bg-red-500" :
              "bg-emerald-500"
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              currentState === "disconnected" ? "bg-slate-600" :
              currentState === "error" ? "bg-red-600" :
              "bg-emerald-600"
            }`}></span>
          </span>
          <span className={`text-[10px] font-mono font-medium uppercase tracking-wider ${theme === "premium-light" ? "text-stone-500" : "text-slate-400"}`}>
            {currentState}
          </span>
        </div>
      </div>

      {/* Real-time Transcription Stream Panel (Top Sticky Overlay when active) */}
      <div className={`px-5 py-4 min-h-[96px] flex flex-col justify-center border-b transition-all duration-300 ${
        theme === "premium-light"
          ? "bg-purple-500/[0.02] border-stone-200/60"
          : "bg-purple-500/5 border-slate-900/40"
      }`}>
        <div className="space-y-3">
          {/* User speaking transcription stream */}
          <div className="flex items-start space-x-3">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 ${theme === "premium-light" ? "bg-blue-50 text-blue-600" : "bg-blue-500/10 text-blue-400"}`}>YOU</span>
            <div className="flex-1">
              <p className={`text-sm font-sans font-medium ${theme === "premium-light" ? "text-stone-800" : "text-slate-200"}`}>
                {transcription.user ? (
                  <span className="animate-pulse">{transcription.user}</span>
                ) : (
                  <span className={`${theme === "premium-light" ? "text-stone-400" : "text-slate-500"} italic text-xs`}>Waiting for your voice input...</span>
                )}
              </p>
            </div>
          </div>

          {/* Liya speaking transcription stream */}
          <div className="flex items-start space-x-3 border-t border-slate-900/20 pt-2.5">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 ${theme === "premium-light" ? "bg-purple-50 text-purple-600" : "bg-violet-500/10 text-violet-400"}`}>LIYA</span>
            <div className="flex-1">
              <p className={`text-sm font-sans font-medium ${theme === "premium-light" ? "text-stone-900" : "text-purple-100"}`}>
                {transcription.liya ? (
                  <span>{transcription.liya}</span>
                ) : currentState === "thinking" ? (
                  <span className={`${theme === "premium-light" ? "text-purple-600" : "text-purple-400"} animate-pulse text-xs`}>Liya is processing...</span>
                ) : (
                  <span className={`${theme === "premium-light" ? "text-stone-400" : "text-slate-500"} italic text-xs`}>Silent</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Log History Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 p-5 overflow-y-auto space-y-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`flex flex-col items-center justify-center h-full space-y-3 py-10 text-center ${theme === "premium-light" ? "text-stone-500" : "text-slate-500"}`}
            >
              <Cpu className={`w-8 h-8 animate-pulse ${theme === "premium-light" ? "text-stone-300" : "text-slate-700"}`} />
              <p className="text-xs">No active transcripts. Summon Liya to begin conversation.</p>
              <div className={`p-3 rounded-lg max-w-[250px] space-y-1.5 border ${theme === "premium-light" ? "bg-stone-100/50 border-stone-200" : "bg-slate-900/40 border-slate-800/40"}`}>
                <span className={`text-[9px] block font-semibold uppercase ${theme === "premium-light" ? "text-stone-500" : "text-slate-400"}`}>Try asking:</span>
                <span className={`${theme === "premium-light" ? "text-stone-600" : "text-slate-400"} block text-left`}>• &quot;Hey Liya, open YouTube&quot;</span>
                <span className={`${theme === "premium-light" ? "text-stone-600" : "text-slate-400"} block text-left`}>• &quot;Search Google for beautiful beaches&quot;</span>
                <span className={`${theme === "premium-light" ? "text-stone-600" : "text-slate-400"} block text-left`}>• &quot;Can you copy this snippet?&quot;</span>
              </div>
            </motion.div>
          ) : (
            logs.map((log) => {
              const isUser = log.sender === "user";
              const isLiya = log.sender === "liya";
              const isSys = log.sender === "system";

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start space-x-2.5 p-3 rounded-xl border ${
                    isUser ? (theme === "premium-light" ? "bg-blue-50/50 border-blue-200 text-blue-800" : "bg-blue-950/20 border-blue-900/25 text-blue-200") :
                    isLiya ? (theme === "premium-light" ? "bg-purple-50/50 border-purple-200 text-purple-800" : "bg-violet-950/20 border-violet-900/25 text-purple-200") :
                    log.isToolCall ? (theme === "premium-light" ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : "bg-emerald-950/20 border-emerald-900/25 text-emerald-200") :
                    theme === "premium-light" ? "bg-stone-100/50 border-stone-200 text-stone-600" : "bg-slate-900/20 border-slate-800/30 text-slate-400"
                  }`}
                >
                  {/* Timestamp & Type Icon */}
                  <div className="flex flex-col items-center space-y-1 text-slate-500 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span className="text-[8px] font-light">{log.timestamp}</span>
                  </div>

                  {/* Message details */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        isUser ? "text-blue-400" :
                        isLiya ? "text-violet-400" :
                        "text-slate-400"
                      }`}>
                        {log.sender === "user" ? "User speech" : log.sender === "liya" ? "Liya" : "System info"}
                      </span>
                    </div>

                    <p className={`font-sans leading-relaxed ${isUser || isLiya ? "text-xs" : "text-[11px]"}`}>
                      {log.text}
                    </p>

                    {/* Rich Tool Status Renderer */}
                    {log.isToolCall && log.toolDetails && (
                      <div className={`mt-2 p-2 rounded border space-y-1.5 font-mono text-[10px] ${theme === "premium-light" ? "bg-stone-100 border-stone-200" : "bg-slate-900/60 border-slate-800/50"}`}>
                        <div className="flex items-center justify-between">
                          <span className={`${theme === "premium-light" ? "text-emerald-700" : "text-emerald-400"} font-bold flex items-center space-x-1`}>
                            <Cpu className="w-3 h-3 mr-1 animate-pulse" />
                            {log.toolDetails.name}()
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold ${
                            log.toolDetails.status === "success" ? "bg-emerald-500/10 text-emerald-600" :
                            log.toolDetails.status === "error" ? "bg-red-500/10 text-red-600" :
                            "bg-amber-500/10 text-amber-600 animate-pulse"
                          }`}>
                            {log.toolDetails.status}
                          </span>
                        </div>
                        
                        {/* Print arguments */}
                        <div className="text-slate-400 text-[9px] overflow-x-auto whitespace-pre-wrap">
                          <span className="text-slate-500">args:</span> {JSON.stringify(log.toolDetails.args, null, 2)}
                        </div>

                        {/* Print tool execution returns */}
                        {log.toolDetails.result && (
                          <div className="text-slate-400 text-[9px] border-t border-slate-800/60 pt-1">
                            <span className="text-slate-500">output:</span> {JSON.stringify(log.toolDetails.result, null, 2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
