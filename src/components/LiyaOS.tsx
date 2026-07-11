import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, FileCode, Music, Activity, Terminal, Folder, FileText, Calculator, Palette, Settings, Cpu, X, Minus, Square } from "lucide-react";
import VirtualBrowser from "./apps/VirtualBrowser";
import VirtualVSCode from "./apps/VirtualVSCode";
import VirtualSpotify from "./apps/VirtualSpotify";
import VirtualTaskManager from "./apps/VirtualTaskManager";
import VirtualTerminal from "./apps/VirtualTerminal";
import VirtualCalculator from "./apps/VirtualCalculator";
import VirtualPaint from "./apps/VirtualPaint";
import VirtualNotepad from "./apps/VirtualNotepad";
import VirtualFileExplorer from "./apps/VirtualFileExplorer";
import VirtualSettings from "./apps/VirtualSettings";
import ResearchDashboard from "./apps/ResearchDashboard";
import { OSWindow } from "../types";

interface LiyaOSProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
  liyaMemory: any;
  onClearMemory: () => void;
}

const defaultApps = [
  { name: "Browser", icon: Globe, color: "bg-blue-500/20 text-blue-400 border-blue-500/20" },
  { name: "VS Code", icon: FileCode, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20" },
  { name: "Spotify", icon: Music, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" },
  { name: "Task Manager", icon: Activity, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/20" },
  { name: "Command Prompt", icon: Terminal, color: "bg-slate-500/20 text-slate-400 border-slate-500/20" },
  { name: "File Explorer", icon: Folder, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20" },
  { name: "Notepad", icon: FileText, color: "bg-amber-500/20 text-amber-400 border-amber-500/20" },
  { name: "Calculator", icon: Calculator, color: "bg-purple-500/20 text-purple-400 border-purple-500/20" },
  { name: "Paint", icon: Palette, color: "bg-pink-500/20 text-pink-400 border-pink-500/20" },
  { name: "Settings", icon: Settings, color: "bg-stone-500/20 text-stone-400 border-stone-500/20" },
  { name: "Research Dashboard", icon: Cpu, color: "bg-teal-500/20 text-teal-400 border-teal-500/20" }
];

export default function LiyaOS({ onAddLog, theme, liyaMemory, onClearMemory }: LiyaOSProps) {
  const [osTheme, setOsTheme] = useState<"immersive-dark" | "premium-light">(theme);

  useEffect(() => {
    setOsTheme(theme);
  }, [theme]);

  const [windows, setWindows] = useState<OSWindow[]>([
    {
      id: "browser",
      title: "Google Search - Liya Web",
      appName: "Browser",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 30, y: 30 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "vscode",
      title: "Visual Studio Code",
      appName: "VS Code",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 40, y: 40 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "spotify",
      title: "Spotify Player",
      appName: "Spotify",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 50, y: 50 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "taskmgr",
      title: "Task Manager",
      appName: "Task Manager",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 60, y: 60 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "terminal",
      title: "Command Prompt",
      appName: "Command Prompt",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 70, y: 70 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "explorer",
      title: "File Explorer",
      appName: "File Explorer",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 80, y: 80 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "notepad",
      title: "Notepad",
      appName: "Notepad",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 90, y: 90 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "calculator",
      title: "Calculator",
      appName: "Calculator",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 100, y: 100 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "paint",
      title: "Paint Pad",
      appName: "Paint",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 110, y: 110 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "settings",
      title: "System Settings",
      appName: "Settings",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 120, y: 120 },
      size: { width: "100%", height: "500px" }
    },
    {
      id: "research_dashboard",
      title: "Autonomous Web Research Dashboard",
      appName: "Research Dashboard",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 1,
      position: { x: 130, y: 130 },
      size: { width: "100%", height: "520px" }
    }
  ]);

  const [topZIndex, setTopZIndex] = useState<number>(10);

  // Sync opening apps with Liya's natural voice calls
  useEffect(() => {
    const handleOpenApp = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { appName } = customEvent.detail;
      onAddLog("system", `[Liya OS] Speech-Triggered Application Launcher: ${appName}`);

      setTopZIndex(prevZ => {
        const nextZ = prevZ + 1;
        setTimeout(() => {
          setWindows(prev => prev.map(w => {
            if (w.appName.toLowerCase() === appName.toLowerCase()) {
              return {
                ...w,
                isOpen: true,
                isMinimized: false,
                zIndex: nextZ
              };
            }
            return w;
          }));
        }, 0);
        return nextZ;
      });
    };

    const handleSystemControl = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { action, appName } = customEvent.detail;
      onAddLog("system", `[Liya OS] Speech-Triggered System Control: ${action} on ${appName}`);

      if (action === "focus") {
        setTopZIndex(prevZ => {
          const nextZ = prevZ + 1;
          setTimeout(() => {
            setWindows(prev => prev.map(w => {
              if (w.appName.toLowerCase() === appName.toLowerCase() || !appName) {
                return { ...w, isMinimized: false, zIndex: nextZ };
              }
              return w;
            }));
          }, 0);
          return nextZ;
        });
      } else {
        setWindows(prev => prev.map(w => {
          if (w.appName.toLowerCase() === appName.toLowerCase() || !appName) {
            if (action === "close") {
              return { ...w, isOpen: false };
            } else if (action === "minimize") {
              return { ...w, isMinimized: true };
            } else if (action === "maximize") {
              return { ...w, isMaximized: true };
            }
          }
          return w;
        }));
      }
    };

    window.addEventListener("liya-open-app", handleOpenApp);
    window.addEventListener("liya-system-control", handleSystemControl);
    return () => {
      window.removeEventListener("liya-open-app", handleOpenApp);
      window.removeEventListener("liya-system-control", handleSystemControl);
    };
  }, [onAddLog]);

  const bringToFront = (id: string) => {
    setTopZIndex(prevZ => {
      const nextZ = prevZ + 1;
      setTimeout(() => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZ, isMinimized: false } : w));
      }, 0);
      return nextZ;
    });
  };

  const toggleWindow = (appName: string) => {
    const w = windows.find(win => win.appName === appName);
    if (!w) return;

    if (!w.isOpen) {
      onAddLog("system", `Launched ${appName}`);
      setTopZIndex(prevZ => {
        const nextZ = prevZ + 1;
        setTimeout(() => {
          setWindows(prevWindows => prevWindows.map(win => {
            if (win.appName === appName) {
              return { ...win, isOpen: true, isMinimized: false, zIndex: nextZ };
            }
            return win;
          }));
        }, 0);
        return nextZ;
      });
    } else if (w.isMinimized) {
      setTopZIndex(prevZ => {
        const nextZ = prevZ + 1;
        setTimeout(() => {
          setWindows(prevWindows => prevWindows.map(win => {
            if (win.appName === appName) {
              return { ...win, isMinimized: false, zIndex: nextZ };
            }
            return win;
          }));
        }, 0);
        return nextZ;
      });
    } else {
      const isHighestZ = w.zIndex === topZIndex;
      if (isHighestZ) {
        setWindows(prevWindows => prevWindows.map(win => {
          if (win.appName === appName) {
            return { ...win, isMinimized: true };
          }
          return win;
        }));
      } else {
        setTopZIndex(prevZ => {
          const nextZ = prevZ + 1;
          setTimeout(() => {
            setWindows(prevWindows => prevWindows.map(win => {
              if (win.appName === appName) {
                return { ...win, zIndex: nextZ };
              }
              return win;
            }));
          }, 0);
          return nextZ;
        });
      }
    }
  };

  const handleClose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: false } : w));
    const closedApp = windows.find(w => w.id === id)?.appName;
    if (closedApp) {
      onAddLog("system", `Closed ${closedApp}`);
    }
  };

  const handleMinimize = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
  };

  const handleMaximizeToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  };

  const activeAppsList = windows.filter(w => w.isOpen).map(w => w.appName);

  const renderAppContent = (appName: string) => {
    switch (appName) {
      case "Browser":
        return <VirtualBrowser onAddLog={onAddLog} theme={osTheme} />;
      case "VS Code":
        return <VirtualVSCode onAddLog={onAddLog} theme={osTheme} />;
      case "Spotify":
        return <VirtualSpotify onAddLog={onAddLog} />;
      case "Task Manager":
        return (
          <VirtualTaskManager
            onAddLog={onAddLog}
            theme={osTheme}
            activeApps={activeAppsList}
            onKillApp={(app) => setWindows(prev => prev.map(w => w.appName === app ? { ...w, isOpen: false } : w))}
            latencyLogs={[]}
          />
        );
      case "Command Prompt":
        return <VirtualTerminal onAddLog={onAddLog} theme={osTheme} />;
      case "File Explorer":
        return <VirtualFileExplorer onAddLog={onAddLog} theme={osTheme} />;
      case "Notepad":
        return <VirtualNotepad theme={osTheme} />;
      case "Calculator":
        return <VirtualCalculator theme={osTheme} />;
      case "Paint":
        return <VirtualPaint theme={osTheme} />;
      case "Settings":
        return (
          <VirtualSettings
            theme={osTheme}
            onChangeTheme={setOsTheme}
            liyaMemory={liyaMemory}
            onClearMemory={onClearMemory}
          />
        );
      case "Research Dashboard":
        return <ResearchDashboard onAddLog={onAddLog} theme={osTheme} />;
      default:
        return <div className="p-4">App not implemented</div>;
    }
  };

  return (
    <div className={`w-full min-h-[440px] md:min-h-[580px] rounded-3xl p-4 md:p-6 flex flex-col relative overflow-hidden transition-all duration-300 border select-none ${
      osTheme === "premium-light"
        ? "bg-stone-50/50 border-stone-200/60 shadow-xl"
        : "bg-slate-950/40 border-white/[0.03] shadow-[0_0_30px_-15px_rgba(30,41,59,0.3)]"
    }`}>
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-pink-500/5 -z-10 pointer-events-none" />

      {/* Grid of Launcher Icons */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-6 p-2 md:p-4 pb-20 items-start overflow-y-auto">
        {defaultApps.map((app) => {
          const isOpen = windows.find(w => w.appName === app.name)?.isOpen;
          const isMinimized = windows.find(w => w.appName === app.name)?.isMinimized;
          
          return (
            <motion.button
              key={app.name}
              onClick={() => toggleWindow(app.name)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all duration-300 relative group cursor-pointer ${
                isOpen && !isMinimized
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-500 shadow-md"
                  : (osTheme === "premium-light" ? "bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:shadow-sm" : "bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03] text-slate-400 hover:text-white")
              }`}
            >
              <div className={`p-3 rounded-2xl border ${app.color} group-hover:scale-105 transition-transform`}>
                <app.icon className="w-5.5 h-5.5 stroke-[1.8]" />
              </div>
              <span className="text-[10px] font-bold font-mono tracking-wider mt-2.5 uppercase text-center truncate max-w-full">
                {app.name}
              </span>

              {/* Status dots */}
              {isOpen && (
                <div className="absolute bottom-1.5 flex space-x-1 justify-center">
                  <div className={`w-1 h-1 rounded-full ${isMinimized ? "bg-yellow-400" : "bg-emerald-400 animate-pulse"}`} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Windows Layer */}
      <AnimatePresence>
        {windows.map((w) => {
          if (!w.isOpen || w.isMinimized) return null;

          return (
            <motion.div
              key={w.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={() => bringToFront(w.id)}
              style={{ zIndex: w.zIndex }}
              className={`absolute border rounded-3xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${
                w.isMaximized
                  ? "top-4 left-4 right-4 bottom-24 h-[calc(100%-110px)]"
                  : "top-8 left-8 right-8 bottom-28 h-[calc(100%-130px)] md:top-14 md:left-14 md:right-14 md:bottom-32 md:h-[calc(100%-160px)]"
              } ${
                osTheme === "premium-light"
                  ? "bg-white border-stone-200 text-stone-800"
                  : "bg-slate-900 border-slate-800 text-slate-100"
              }`}
            >
              {/* Window Header */}
              <div className={`px-4.5 py-3.5 border-b flex items-center justify-between cursor-default ${
                osTheme === "premium-light" ? "bg-stone-50 border-stone-200" : "bg-black/20 border-slate-800/80"
              }`}>
                {/* Window controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => handleClose(w.id, e)}
                    className="w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-red-950 font-black cursor-pointer hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                  <button
                    onClick={(e) => handleMinimize(w.id, e)}
                    className="w-3.5 h-3.5 rounded-full bg-yellow-500 flex items-center justify-center text-[8px] text-yellow-950 font-black cursor-pointer hover:bg-yellow-600 transition-colors"
                  >
                    -
                  </button>
                  <button
                    onClick={(e) => handleMaximizeToggle(w.id, e)}
                    className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center text-[6px] text-emerald-950 font-black cursor-pointer hover:bg-emerald-600 transition-colors"
                  >
                    ⤢
                  </button>
                </div>

                <span className={`text-[11px] font-bold font-mono tracking-widest uppercase truncate max-w-xs md:max-w-md ${
                  osTheme === "premium-light" ? "text-stone-700" : "text-slate-400"
                }`}>
                  {w.appName}
                </span>

                <div className="w-14" /> {/* Spacer */}
              </div>

              {/* Window Content */}
              <div className="flex-1 overflow-hidden relative">
                {renderAppContent(w.appName)}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Dock / bottom task bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 p-3.5 bg-black/40 backdrop-blur-md rounded-2xl border border-white/[0.04] shadow-xl max-w-md select-none">
        {defaultApps.map((app) => {
          const isOpen = windows.find(w => w.appName === app.name)?.isOpen;
          const isMinimized = windows.find(w => w.appName === app.name)?.isMinimized;

          return (
            <button
              key={app.name}
              onClick={() => toggleWindow(app.name)}
              className="relative p-2 rounded-xl hover:bg-white/5 transition-all text-slate-400 hover:text-white cursor-pointer group"
              title={app.name}
            >
              <app.icon className="w-4.5 h-4.5" />
              
              {/* Pulsing Dot indicator */}
              {isOpen && (
                <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                  isMinimized ? "bg-yellow-400" : "bg-emerald-500"
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
