import React, { useState } from "react";
import { Folder, File, ArrowLeft, Trash2, ExternalLink } from "lucide-react";

interface FileItem {
  name: string;
  type: "file" | "dir";
  size?: string;
  associatedApp?: string;
  children?: FileItem[];
}

interface VirtualFileExplorerProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
}

const initialFiles: FileItem[] = [
  {
    name: "Documents",
    type: "dir",
    children: [
      { name: "liya_agent_instructions.txt", type: "file", size: "1.2 KB", associatedApp: "Notepad" },
      { name: "consolidated_memories.txt", type: "file", size: "4.8 KB", associatedApp: "Notepad" },
      { name: "project_architecture.json", type: "file", size: "850 B", associatedApp: "VS Code" }
    ]
  },
  {
    name: "Downloads",
    type: "dir",
    children: [
      { name: "synth_chill_lofi.wav", type: "file", size: "14.2 MB", associatedApp: "Spotify" },
      { name: "liya_wallpaper.png", type: "file", size: "2.4 MB", associatedApp: "Paint" }
    ]
  },
  {
    name: "Pictures",
    type: "dir",
    children: [
      { name: "agent_portrait.png", type: "file", size: "1.8 MB", associatedApp: "Paint" },
      { name: "avatar_vector.svg", type: "file", size: "12 KB", associatedApp: "Paint" }
    ]
  },
  {
    name: "System",
    type: "dir",
    children: [
      { name: "diagnostics_kernel.sys", type: "file", size: "64 KB", associatedApp: "Task Manager" },
      { name: "websocket_bus.sys", type: "file", size: "12 KB", associatedApp: "Task Manager" }
    ]
  }
];

export default function VirtualFileExplorer({ onAddLog, theme }: VirtualFileExplorerProps) {
  const [currentFolder, setCurrentFolder] = useState<FileItem | null>(null);
  const [rootFiles, setRootFiles] = useState<FileItem[]>(initialFiles);

  const handleFolderClick = (folder: FileItem) => {
    setCurrentFolder(folder);
    onAddLog("system", `Opened folder: C:\\Liya\\Workspace\\${folder.name}`);
  };

  const handleBack = () => {
    setCurrentFolder(null);
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.associatedApp) {
      onAddLog("system", `Launching app '${file.associatedApp}' to open file: ${file.name}`);
      // Dispatch custom event to trigger app open in LiyaOS parent context
      window.dispatchEvent(new CustomEvent("liya-open-app", {
        detail: { appName: file.associatedApp }
      }));
    } else {
      onAddLog("system", `No associated application found for file ${file.name}`);
    }
  };

  const handleDeleteItem = (itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Safety confirmation layer: "Require confirmation before performing potentially destructive actions."
    if (confirm(`⚠️ CRITICAL SECURITY WARNING:\n\nAre you sure you want to permanently delete '${itemName}' from Liya's file index?\nThis operation is irreversible.`)) {
      if (currentFolder) {
        const updatedChildren = currentFolder.children?.filter(c => c.name !== itemName) || [];
        const updatedRoot = rootFiles.map(folder => {
          if (folder.name === currentFolder.name) {
            return { ...folder, children: updatedChildren };
          }
          return folder;
        });
        setRootFiles(updatedRoot);
        setCurrentFolder({ ...currentFolder, children: updatedChildren });
      } else {
        setRootFiles(rootFiles.filter(f => f.name !== itemName));
      }
      onAddLog("system", `⚠️ Destructive action approved: Permanent deletion of ${itemName}`);
    }
  };

  const itemsToDisplay = currentFolder ? currentFolder.children || [] : rootFiles;

  return (
    <div className={`flex flex-col h-full rounded-2xl p-4 font-sans select-none overflow-hidden ${
      theme === "premium-light" ? "bg-stone-50 border border-stone-200 text-stone-800" : "bg-slate-900 border border-slate-800 text-slate-200"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.03] pb-2 mb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-80">
          {currentFolder ? (
            <button onClick={handleBack} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Folder className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          )}
          <span>File Explorer {currentFolder ? `> ${currentFolder.name}` : ""}</span>
        </div>
        <span className="font-mono text-[9px] tracking-widest text-stone-500">C:\Liya\Workspace\</span>
      </div>

      {/* Grid of contents */}
      <div className="flex-1 overflow-y-auto space-y-1 scrollbar-none">
        {itemsToDisplay.length === 0 ? (
          <div className="text-center py-12 text-stone-500 text-xs font-medium">Directory is empty.</div>
        ) : (
          itemsToDisplay.map((item, idx) => (
            <div
              key={idx}
              onClick={() => item.type === "dir" ? handleFolderClick(item) : handleOpenFile(item)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent cursor-pointer transition-all ${
                theme === "premium-light"
                  ? "bg-white border-stone-100 hover:border-stone-200 hover:shadow-sm text-stone-800"
                  : "bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03] hover:border-white/5 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.type === "dir" ? (
                  <Folder className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-blue-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold font-mono truncate leading-snug">{item.name}</p>
                  {item.size && <p className="text-[9px] text-stone-500 font-mono mt-0.5">{item.size}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.associatedApp && (
                  <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-blue-500/10">
                    <span>{item.associatedApp}</span>
                    <ExternalLink className="w-2 h-2" />
                  </span>
                )}
                <button
                  onClick={(e) => handleDeleteItem(item.name, e)}
                  className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-stone-500 transition-colors"
                  title="Permanently Delete Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
