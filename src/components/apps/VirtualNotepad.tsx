import { useState, useEffect } from "react";
import { FileText, Save, CloudLightning } from "lucide-react";

interface VirtualNotepadProps {
  theme: "immersive-dark" | "premium-light";
}

export default function VirtualNotepad({ theme }: VirtualNotepadProps) {
  const [note, setNote] = useState<string>(() => {
    return localStorage.getItem("liya-notepad-note") || "Welcome to Liya's Notepad Scratchpad!\n\nWrite down lists, concepts, code snippets, or thoughts here.\nYour text is automatically saved to local storage!";
  });
  const [saveStatus, setSaveStatus] = useState<string>("Synced");

  useEffect(() => {
    localStorage.setItem("liya-notepad-note", note);
    setSaveStatus("Saving...");
    const timeout = setTimeout(() => {
      setSaveStatus("Synced");
    }, 600);
    return () => clearTimeout(timeout);
  }, [note]);

  return (
    <div className={`flex flex-col h-full rounded-2xl p-4 font-sans select-none overflow-hidden ${
      theme === "premium-light" ? "bg-stone-50 border border-stone-200 text-stone-800" : "bg-slate-900 border border-slate-800 text-slate-200"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.03] pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase opacity-80">
          <FileText className="w-4 h-4 text-blue-500" />
          <span>Notepad Scratchpad</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-stone-500 font-mono font-bold uppercase">
          <CloudLightning className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>{saveStatus}</span>
        </div>
      </div>

      {/* Text Area */}
      <div className="flex-1 rounded-xl overflow-hidden bg-white/5 dark:bg-black/35 border border-white/[0.03] p-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Start typing your notes here..."
          className="w-full h-full bg-transparent border-none outline-none focus:ring-0 text-xs font-medium leading-relaxed resize-none p-0 overflow-y-auto text-stone-800 dark:text-slate-300"
        />
      </div>
    </div>
  );
}
