import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings as SettingsIcon,
  Monitor,
  MonitorPlay,
  Clock,
  Terminal,
  BrainCircuit,
  X,
  Trash2,
  CheckCircle,
  Cpu,
  Info,
  Shield,
  Send,
  FolderKanban,
  RefreshCw,
  Sparkles,
  Play
} from "lucide-react";
import { useLiya } from "./hooks/useLiya";
import { VoiceOrb } from "./components/VoiceOrb";
import { Avatar3D } from "./components/Avatar3D";
import { ConsoleLogs } from "./components/ConsoleLogs";
import { LogEntry } from "./types";

export default function App() {
  const {
    state,
    logs,
    inputVolume,
    outputVolume,
    transcription,
    connect,
    disconnect,
    addLog,
    savedSessions,
    loadSessionLogs,
    deleteSession,
    clearHistory,
    liyaMemory,
    clearLiyaMemory,
    isMicEnabled,
    sendTextMessage,
    sendVideoFrame,
    sendScreenShareStatus,
    sendVisionQuery,
    outputAnalyser,
    permissions,
    setPermissions,
    emotion,
    confirmationRequest,
    setConfirmationRequest,
  } = useLiya();

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"sessions" | "logs" | "memory" | "permissions" | "project" | "skills">("project");
  const [regressionResults, setRegressionResults] = useState<any>(null);
  const [testingStatus, setTestingStatus] = useState<string>("idle"); // idle, running, success, error
  const [textInput, setTextInput] = useState("");
  const [projectData, setProjectData] = useState<any>(null);
  const [isAnalyzingScreen, setIsAnalyzingScreen] = useState(false);

  // Screen sharing state and references
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<any>(null);

  // Poll configuration from server on mount to check API Key availability
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }
        const data = await response.json();
        setHasApiKey(data.hasApiKey);
      } catch (err) {
        console.debug("Failed to fetch server configuration (re-polling soon):", err);
        setHasApiKey((prev) => (prev !== null ? prev : false));
      }
    };

    checkConfig();
    const interval = setInterval(checkConfig, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showSettings && settingsTab === "skills" && !regressionResults && testingStatus === "idle") {
      runRegressionTest();
    }
  }, [showSettings, settingsTab]);

  const fetchProjectData = async () => {
    try {
      const response = await fetch("/api/project/active");
      if (response.ok) {
        const data = await response.json();
        setProjectData(data);
      }
    } catch (e) {
      console.error("Failed to fetch project data:", e);
    }
  };

  const detectProject = async () => {
    try {
      addLog("system", "🔍 Re-scanning workspace to detect project framework & metadata...");
      const response = await fetch("/api/project/detect");
      if (response.ok) {
        const data = await response.json();
        setProjectData(data);
        addLog("system", `📂 Detected project: **${data.name}** (${data.language} + ${data.framework})`);
      }
    } catch (e) {
      console.error("Failed to detect project:", e);
    }
  };

  const saveProjectData = async (updated: any) => {
    try {
      const response = await fetch("/api/project/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (response.ok) {
        setProjectData(updated);
        addLog("system", "💾 Project memory saved successfully.");
      }
    } catch (e) {
      console.error("Failed to save project memory:", e);
    }
  };

  const runRegressionTest = async () => {
    setTestingStatus("running");
    try {
      const res = await fetch("/api/skills/regression-test");
      const data = await res.json();
      setRegressionResults(data);
      if (data.passed) {
        setTestingStatus("success");
        addLog("system", "✅ Deterministic Skill Regression tests passed with 100% success rate.");
      } else {
        setTestingStatus("error");
        addLog("system", "⚠️ Deterministic Skill Regression checks returned some failures.");
      }
    } catch (err: any) {
      console.error("Failed to run regression tests:", err);
      setTestingStatus("error");
    }
  };

  const analyzeScreenOnDemand = async (queryText: string = "What do you see on my screen?") => {
    if (isAnalyzingScreen) return;
    setIsAnalyzingScreen(true);
    try {
      addLog("system", "🖥️ Requesting on-demand screen share frame...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1024 },
          height: { ideal: 576 },
        },
        audio: false
      });

      // Create video element to read stream
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });

      await video.play();

      const canvas = document.createElement("canvas");
      const width = 1024;
      const aspect = video.videoWidth && video.videoHeight ? (video.videoHeight / video.videoWidth) : 0.5625;
      const height = Math.round(aspect * width);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        const base64 = dataUrl.split(",")[1];

        // Stop sharing tracks immediately to preserve user privacy
        stream.getTracks().forEach(track => track.stop());

        addLog("system", "🖥️ Screen capture acquired. Forwarding to Liya's screen understanding model...");
        sendVisionQuery(queryText, base64);
      }
    } catch (err: any) {
      console.error("On-demand screen capture failed:", err);
      addLog("system", `⚠️ Vision mode cancelled: ${err.message || "User denied permission"}`);
    } finally {
      setIsAnalyzingScreen(false);
    }
  };

  useEffect(() => {
    if (showSettings && settingsTab === "project") {
      fetchProjectData();
    }
  }, [showSettings, settingsTab]);

  const handleToggleVoiceLink = () => {
    if (state === "disconnected" || state === "error") {
      connect();
    } else {
      disconnect();
    }
  };

  // Screen sharing start/stop engine
  const startScreenSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { max: 1 },
          width: { ideal: 1024 },
          height: { ideal: 576 },
        },
        audio: false
      });

      screenStreamRef.current = stream;

      // Setup a hidden video element to capture active frames
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      videoRef.current = video;

      await video.play();
      setIsScreenSharing(true);
      sendScreenShareStatus(true);
      addLog("system", "🖥️ Screen sharing permission granted. Screen Vision active (1 FPS).");

      // Set up periodic frame capture (every 1.5 seconds)
      frameIntervalRef.current = setInterval(() => {
        captureFrameAndSend();
      }, 1500);

      // Listen for stream stop from browser's native control bar
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };
    } catch (err: any) {
      console.error("Failed to start screen sharing:", err);
      addLog("system", `⚠️ Failed to share screen: ${err.message || "User cancelled or permission denied"}`);
    }
  };

  const stopScreenSharing = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    setIsScreenSharing(false);
    sendScreenShareStatus(false);
    addLog("system", "🖥️ Screen sharing ended. Screen Vision deactivated.");
  };

  const captureFrameAndSend = () => {
    if (!videoRef.current || !screenStreamRef.current) return;

    const canvas = canvasRef.current || document.createElement("canvas");
    if (!canvasRef.current) {
      canvasRef.current = canvas;
    }

    const video = videoRef.current;
    if (video.readyState < 2) return; // Wait until HAVE_CURRENT_DATA

    const width = 1024;
    const aspect = video.videoWidth && video.videoHeight ? (video.videoHeight / video.videoWidth) : 0.5625;
    const height = Math.round(aspect * width);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      // Compress to low-res JPEG at 0.5 quality for low latency transmission
      const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
      const base64 = dataUrl.split(",")[1];
      if (base64) {
        sendVideoFrame(base64);
      }
    }
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      startScreenSharing();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Listen for immediate frame requests from the server
  useEffect(() => {
    const handleRequestFrame = () => {
      console.log("[App] Server requested immediate capture. Sending fresh frame...");
      captureFrameAndSend();
    };
    window.addEventListener("liya-request-frame", handleRequestFrame);
    return () => {
      window.removeEventListener("liya-request-frame", handleRequestFrame);
    };
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* Ambient Radial background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none -z-10 bg-[radial-gradient(circle,#3b82f605_0%,transparent_70%)]" />

      {/* Top Navigation Bar */}
      <header className="py-4 px-6 border-b border-white/[0.02] bg-slate-950/40 select-none shrink-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex flex-col select-none">
            <h1 className="text-sm font-light tracking-[5px] m-0 uppercase flex items-center gap-1.5 text-slate-200">
              LIYA<span className="text-blue-500 font-bold">.</span>
            </h1>
            <p className="text-[7px] mt-0.5 tracking-[3px] uppercase font-bold text-slate-500">
              VOICE &amp; VISION CORE
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Real-time Connection status pill */}
            <div className="px-3 py-1.5 rounded-full text-[8px] uppercase tracking-widest flex items-center gap-2 font-mono bg-black/30 border border-white/[0.05] text-slate-400">
              <span className={`w-1.5 h-1.5 rounded-full ${
                state === "disconnected" ? "bg-slate-600" :
                state === "error" ? "bg-red-500 shadow-[0_0_8px_#ef4444]" :
                "bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"
              }`} />
              {state === "disconnected" ? "Core Offline" : `${state}`}
            </div>

            {/* Screen Vision Toggle button */}
            <button
              onClick={handleToggleScreenShare}
              title={isScreenSharing ? "Disable Screen Vision" : "Enable Screen Vision"}
              className={`p-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                isScreenSharing
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  : "bg-slate-900 border-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {isScreenSharing ? <MonitorPlay className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            {/* On-demand Vision Button */}
            <button
              onClick={() => analyzeScreenOnDemand("What do you see on my screen? Read the text, open windows, identify code and explain them naturally.")}
              title="Look at My Screen (On-Demand Scan)"
              disabled={isAnalyzingScreen}
              className={`p-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                isAnalyzingScreen
                  ? "bg-purple-500/25 border-purple-500/50 text-purple-300 animate-pulse"
                  : "bg-slate-900 border-white/[0.05] text-slate-400 hover:text-purple-400 hover:bg-slate-800 hover:border-purple-500/20"
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Settings toggler */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl bg-slate-900 border border-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Experiential Center Stage */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative max-w-5xl mx-auto w-full">
        
        {/* State Caption */}
        <div className="mb-10 text-center select-none">
          <AnimatePresence mode="wait">
            <div className="flex flex-col items-center gap-1.5">
              <motion.span
                key={state}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`text-[10px] font-bold uppercase tracking-[4px] font-mono ${
                  state === "disconnected" ? "text-slate-500" :
                  state === "connecting" ? "text-amber-400 animate-pulse" :
                  state === "listening" ? "text-blue-400 animate-pulse" :
                  state === "thinking" ? "text-purple-400 animate-pulse" :
                  state === "speaking" ? "text-violet-300" :
                  state === "executing_tool" ? "text-emerald-400 animate-pulse" : "text-rose-400"
                }`}
              >
                {state === "disconnected" && "System Standby"}
                {state === "connecting" && "Initializing Pipeline..."}
                {state === "listening" && "Listening..."}
                {state === "thinking" && "Processing Memory..."}
                {state === "speaking" && "Liya Responding"}
                {state === "executing_tool" && "Accessing OS Command..."}
                {state === "error" && "Pipeline Error"}
              </motion.span>

              {state !== "disconnected" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="text-[8px] font-mono tracking-[2px] uppercase text-slate-500 flex items-center gap-1"
                >
                  Simulated Emotion: <span className="text-blue-400 font-bold">{emotion}</span>
                </motion.span>
              )}
            </div>
          </AnimatePresence>
        </div>

        {/* Avatar Display Card */}
        <div className="w-64 h-64 md:w-72 md:h-72 flex items-center justify-center shrink-0 mb-6">
          <Avatar3D
            state={state as any}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
            onConnect={connect}
            onDisconnect={disconnect}
            outputAnalyser={outputAnalyser}
            theme="immersive-dark"
            emotion={emotion}
          />
        </div>

        {/* Center-staged Voice Orb Core */}
        <div className="relative my-4">
          <VoiceOrb
            state={state}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
            isMicEnabled={isMicEnabled}
            onClick={handleToggleVoiceLink}
          />
        </div>

        {/* Dynamic Voice Dialogue Caption Overlay */}
        <div className="mt-12 w-full max-w-2xl min-h-[80px] flex items-center justify-center px-4">
          <AnimatePresence mode="wait">
            {state === "speaking" && transcription.liya && (
              <motion.p
                key="speaking-caption"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-base md:text-lg font-light text-slate-100 text-center leading-relaxed tracking-wide font-sans max-w-xl"
              >
                "{transcription.liya}"
              </motion.p>
            )}

            {state === "listening" && transcription.user && (
              <motion.p
                key="listening-caption"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="text-sm md:text-base font-medium text-blue-300 text-center leading-relaxed max-w-xl"
              >
                "{transcription.user}"
              </motion.p>
            )}

            {state === "thinking" && (
              <motion.div
                key="thinking-caption"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[2px] text-slate-500 animate-pulse"
              >
                <span>Retrieving context layers</span>
                <span className="dot animate-[bounce_1s_infinite_100ms]">.</span>
                <span className="dot animate-[bounce_1s_infinite_200ms]">.</span>
                <span className="dot animate-[bounce_1s_infinite_300ms]">.</span>
              </motion.div>
            )}

            {state === "executing_tool" && (
              <motion.div
                key="tool-caption"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-mono uppercase tracking-[2px] text-emerald-400 animate-pulse"
              >
                Running Native OS plugin
              </motion.div>
            )}

            {state === "disconnected" && (
              <motion.p
                key="idle-caption"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                className="text-xs text-slate-500 text-center font-mono uppercase tracking-widest leading-relaxed max-w-md"
              >
                Click Orb to awake Liya Voice Assistant
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Sleek Dynamic Text Request Input */}
        {state !== "disconnected" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg mt-6 relative flex items-center bg-slate-900/45 border border-white/5 rounded-2xl px-4 py-2.5 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all duration-300 shadow-xl"
          >
            <input
              type="text"
              placeholder="Type a query or command to Liya..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && textInput.trim()) {
                  sendTextMessage(textInput.trim());
                  setTextInput("");
                }
              }}
              className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder-slate-500 pr-10"
            />
            <button
              onClick={() => {
                if (textInput.trim()) {
                  sendTextMessage(textInput.trim());
                  setTextInput("");
                }
              }}
              className="absolute right-3 p-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600 border border-blue-500/15 hover:border-blue-500 text-blue-400 hover:text-white transition duration-200 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* Real-time Picture-in-Picture display capture widget */}
        {isScreenSharing && (
          <div className="absolute bottom-6 right-6 w-44 h-26 bg-slate-950/90 border border-blue-500/35 rounded-xl overflow-hidden shadow-2xl z-40 select-none">
            <div className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded text-[7px] uppercase tracking-widest font-mono font-bold bg-blue-500 text-white flex items-center gap-1 shadow">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-ping" />
              Vision Feed
            </div>
            <video
              ref={(el) => {
                if (el && screenStreamRef.current) {
                  el.srcObject = screenStreamRef.current;
                }
              }}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover opacity-70"
            />
          </div>
        )}

      </main>

      {/* Settings Panel Overlay Drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-4xl h-[75vh] rounded-3xl border border-white/5 bg-slate-950/90 shadow-2xl flex flex-col md:flex-row overflow-hidden relative"
            >
              {/* Drawer Sidebar */}
              <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-white/5 bg-slate-900/15 p-5 flex flex-col justify-between shrink-0">
                <div className="space-y-6">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Control Center</span>
                    <h3 className="text-xs font-light tracking-[2px] text-white mt-1">SETTINGS HUD</h3>
                  </div>

                  <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
                    <button
                      onClick={() => setSettingsTab("sessions")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 w-full shrink-0 text-left cursor-pointer ${
                        settingsTab === "sessions"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Saved Sessions
                    </button>

                    <button
                      onClick={() => setSettingsTab("logs")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 w-full shrink-0 text-left cursor-pointer ${
                        settingsTab === "logs"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                      }`}
                    >
                      <Terminal className="w-4 h-4" />
                      Developer Logs
                    </button>

                    <button
                      onClick={() => setSettingsTab("memory")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 w-full shrink-0 text-left cursor-pointer ${
                        settingsTab === "memory"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                      }`}
                    >
                      <BrainCircuit className="w-4 h-4" />
                      Memory Layers
                    </button>

                    <button
                      onClick={() => setSettingsTab("project")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 w-full shrink-0 text-left cursor-pointer ${
                        settingsTab === "project"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                      }`}
                    >
                      <FolderKanban className="w-4 h-4" />
                      Project Memory
                    </button>

                    <button
                      onClick={() => setSettingsTab("permissions")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 w-full shrink-0 text-left cursor-pointer ${
                        settingsTab === "permissions"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      System Permissions
                    </button>

                    <button
                      onClick={() => setSettingsTab("skills")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 w-full shrink-0 text-left cursor-pointer ${
                        settingsTab === "skills"
                          ? "bg-blue-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                      }`}
                    >
                      <Cpu className="w-4 h-4 text-purple-400 animate-pulse" />
                      Deterministic Skills
                    </button>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-1.5 text-[8px] font-mono text-slate-500 uppercase tracking-widest">
                  <Cpu className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  <span>Liya pipeline OS</span>
                </div>
              </div>

              {/* Contents Panel */}
              <div className="flex-1 p-6 overflow-y-auto relative flex flex-col bg-slate-950/30">
                
                {/* Close Button */}
                <button
                  onClick={() => setShowSettings(false)}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer z-50"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Sub views */}
                <div className="flex-1 min-h-0">
                  {settingsTab === "logs" && (
                    <div className="w-full h-full flex flex-col">
                      <div className="mb-4">
                        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                          <Terminal className="w-4 h-4 text-purple-400" /> HUD LOGS &amp; DIAGNOSTICS
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Real-time system actions, tool calls, and WebSocket telemetry status.</p>
                      </div>
                      <div className="flex-1 h-[45h]">
                        <ConsoleLogs
                          logs={logs}
                          transcription={transcription}
                          currentState={state}
                          theme="immersive-dark"
                        />
                      </div>
                    </div>
                  )}

                  {settingsTab === "sessions" && (
                    <div className="space-y-5">
                      <div className="border-b border-white/5 pb-3">
                        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                          <Clock className="w-4 h-4 text-amber-400" /> HISTORIC VOICE DIALOGUES
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Dialogue transactions are automatically archived to local persistent store.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Saved Sessions</h4>
                          {savedSessions.length > 0 && (
                            <button
                              onClick={clearHistory}
                              className="text-[9px] uppercase tracking-wider font-mono text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Clear History
                            </button>
                          )}
                        </div>

                        {savedSessions.length === 0 ? (
                          <div className="text-center py-12 border border-white/[0.02] bg-white/[0.01] rounded-2xl text-xs text-slate-500 font-mono">
                            No archived voice sessions found.
                          </div>
                        ) : (
                          <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
                            {savedSessions.map((session) => (
                              <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/20 border border-white/[0.03] hover:border-white/10 transition">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-bold text-slate-200">{session.title}</span>
                                  <span className="text-[9px] font-mono text-slate-500">{session.timestamp} • {session.logCount} logs</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      loadSessionLogs(session.id);
                                      addLog("system", `📂 Reloaded historic dialogue session: "${session.title}"`);
                                      setShowSettings(false);
                                    }}
                                    className="text-[10px] font-bold uppercase font-mono bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg transition cursor-pointer"
                                  >
                                    Load
                                  </button>
                                  <button
                                    onClick={() => deleteSession(session.id)}
                                    className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/15 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {settingsTab === "memory" && (
                    <div className="space-y-5">
                      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                            <BrainCircuit className="w-4 h-4 text-pink-400" /> PERSISTENT COGNITIVE LAYERS
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Episodic core memories consolidated organically across dialogue pipelines.</p>
                        </div>
                        <button
                          onClick={() => {
                            clearLiyaMemory();
                            addLog("system", "🧹 Persistent memory files reset successfully.");
                          }}
                          className="text-[9px] uppercase tracking-wider font-mono text-red-400 hover:text-red-300 flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg border border-red-500/20 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Wipe Memory
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-900/25 border border-white/[0.03] space-y-2">
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono block">User Profile</span>
                          <div className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded-lg border border-white/[0.02] max-h-40 overflow-y-auto">
                            {liyaMemory?.profile && Object.keys(liyaMemory.profile).length > 0 ? (
                              <pre className="whitespace-pre-wrap">{JSON.stringify(liyaMemory.profile, null, 2)}</pre>
                            ) : (
                              <p className="text-slate-500 text-[10px] italic">No profile layer recorded.</p>
                            )}
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/25 border border-white/[0.03] space-y-2">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono block">Interests &amp; Tech Stack</span>
                          <div className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded-lg border border-white/[0.02] max-h-40 overflow-y-auto">
                            {liyaMemory?.interests && Object.keys(liyaMemory.interests).length > 0 ? (
                              <pre className="whitespace-pre-wrap">{JSON.stringify(liyaMemory.interests, null, 2)}</pre>
                            ) : (
                              <p className="text-slate-500 text-[10px] italic">No tech stack or interests layers registered.</p>
                            )}
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/25 border border-white/[0.03] space-y-2">
                          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest font-mono block">Active Projects</span>
                          <div className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded-lg border border-white/[0.02] max-h-40 overflow-y-auto">
                            {liyaMemory?.projects && Object.keys(liyaMemory.projects).length > 0 ? (
                              <pre className="whitespace-pre-wrap">{JSON.stringify(liyaMemory.projects, null, 2)}</pre>
                            ) : (
                              <p className="text-slate-500 text-[10px] italic">No active projects registered.</p>
                            )}
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-900/25 border border-white/[0.03] space-y-2">
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-mono block">Taught Facts</span>
                          <div className="text-xs text-slate-300 font-mono bg-black/40 p-3 rounded-lg border border-white/[0.02] max-h-40 overflow-y-auto">
                            {liyaMemory?.facts && liyaMemory.facts.length > 0 ? (
                              <pre className="whitespace-pre-wrap">{JSON.stringify(liyaMemory.facts, null, 2)}</pre>
                            ) : (
                              <p className="text-slate-500 text-[10px] italic">No taught facts consolidated.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === "project" && (
                    <div className="space-y-6">
                      <div className="border-b border-white/5 pb-4 flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                            <FolderKanban className="w-4 h-4 text-blue-400" /> ACTIVE WORKSPACE INTELLIGENCE
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Liya automatically monitors development workspaces, tracks files, and guides sprint resumption.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={detectProject}
                            className="text-[9px] uppercase tracking-wider font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 rounded-xl border border-blue-500/20 cursor-pointer transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Re-scan Folder
                          </button>
                          <button
                            onClick={() => {
                              sendTextMessage("Continue my Liya project");
                              setShowSettings(false);
                            }}
                            className="text-[9px] uppercase tracking-wider font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-xl border border-emerald-500/20 cursor-pointer transition-all"
                          >
                            <Play className="w-3.5 h-3.5" /> Resume Work
                          </button>
                        </div>
                      </div>

                      {projectData ? (
                        <div className="space-y-6">
                          {/* Project Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-900/40 border border-white/[0.03] rounded-2xl p-4 flex flex-col gap-1">
                              <span className="text-[8px] font-mono font-bold tracking-widest text-slate-500 uppercase">PROJECT NAME</span>
                              <span className="text-xs font-bold text-white font-mono break-all">{projectData.name || "Unnamed Project"}</span>
                            </div>
                            <div className="bg-slate-900/40 border border-white/[0.03] rounded-2xl p-4 flex flex-col gap-1">
                              <span className="text-[8px] font-mono font-bold tracking-widest text-slate-500 uppercase">TECH LAYER</span>
                              <span className="text-xs font-bold text-blue-400 font-mono capitalize">{projectData.language || "Unknown"} + {projectData.framework || "Unknown"}</span>
                            </div>
                            <div className="bg-slate-900/40 border border-white/[0.03] rounded-2xl p-4 flex flex-col gap-1">
                              <span className="text-[8px] font-mono font-bold tracking-widest text-slate-500 uppercase">WORKSPACE PATH</span>
                              <span className="text-[10px] font-bold text-slate-400 font-mono break-all">{projectData.path || "./"}</span>
                            </div>
                          </div>

                          {/* Editable Textareas for Workspace Context */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Goals */}
                            <div className="bg-slate-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2 flex flex-col">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-indigo-400 uppercase">PROJECT GOALS</span>
                              <textarea
                                value={projectData.goals || ""}
                                onChange={(e) => setProjectData({ ...projectData, goals: e.target.value })}
                                placeholder="Describe project requirements or future objectives..."
                                className="flex-1 min-h-[90px] bg-black/30 border border-white/[0.05] rounded-xl p-2.5 text-xs text-slate-300 font-mono outline-none focus:border-blue-500/30 transition resize-none"
                              />
                            </div>

                            {/* Completed Features */}
                            <div className="bg-slate-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2 flex flex-col">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-emerald-400 uppercase">COMPLETED FEATURES</span>
                              <textarea
                                value={projectData.completed_features || ""}
                                onChange={(e) => setProjectData({ ...projectData, completed_features: e.target.value })}
                                placeholder="List features that have been completed in this project..."
                                className="flex-1 min-h-[90px] bg-black/30 border border-white/[0.05] rounded-xl p-2.5 text-xs text-slate-300 font-mono outline-none focus:border-blue-500/30 transition resize-none"
                              />
                            </div>

                            {/* Pending Tasks */}
                            <div className="bg-slate-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2 flex flex-col">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-amber-400 uppercase">PENDING TASKS</span>
                              <textarea
                                value={projectData.pending_tasks || ""}
                                onChange={(e) => setProjectData({ ...projectData, pending_tasks: e.target.value })}
                                placeholder="Sprint tasks remaining or next steps..."
                                className="flex-1 min-h-[90px] bg-black/30 border border-white/[0.05] rounded-xl p-2.5 text-xs text-slate-300 font-mono outline-none focus:border-blue-500/30 transition resize-none"
                              />
                            </div>

                            {/* Known Bugs */}
                            <div className="bg-slate-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2 flex flex-col">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-rose-400 uppercase">KNOWN BUGS / BLOCKS</span>
                              <textarea
                                value={projectData.known_bugs || ""}
                                onChange={(e) => setProjectData({ ...projectData, known_bugs: e.target.value })}
                                placeholder="Unresolved errors, crashes, or stacktrace blocks..."
                                className="flex-1 min-h-[90px] bg-black/30 border border-white/[0.05] rounded-xl p-2.5 text-xs text-slate-300 font-mono outline-none focus:border-blue-500/30 transition resize-none"
                              />
                            </div>

                            {/* Important Files */}
                            <div className="bg-slate-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2 flex flex-col">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-sky-400 uppercase">IMPORTANT FILES</span>
                              <textarea
                                value={projectData.important_files || ""}
                                onChange={(e) => setProjectData({ ...projectData, important_files: e.target.value })}
                                placeholder="Core source paths (e.g. server.ts, App.tsx, liya.db)..."
                                className="flex-1 min-h-[90px] bg-black/30 border border-white/[0.05] rounded-xl p-2.5 text-xs text-slate-300 font-mono outline-none focus:border-blue-500/30 transition resize-none"
                              />
                            </div>

                            {/* Architecture */}
                            <div className="bg-slate-900/20 border border-white/[0.03] rounded-2xl p-4 space-y-2 flex flex-col">
                              <span className="text-[9px] font-mono font-bold tracking-widest text-purple-400 uppercase">SYSTEM ARCHITECTURE</span>
                              <textarea
                                value={projectData.architecture || ""}
                                onChange={(e) => setProjectData({ ...projectData, architecture: e.target.value })}
                                placeholder="Explain system layers, microservices, frameworks..."
                                className="flex-1 min-h-[90px] bg-black/30 border border-white/[0.05] rounded-xl p-2.5 text-xs text-slate-300 font-mono outline-none focus:border-blue-500/30 transition resize-none"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => saveProjectData(projectData)}
                              className="text-xs font-bold uppercase font-mono bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl cursor-pointer transition shadow"
                            >
                              Save Project Memory
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 border border-white/[0.02] bg-white/[0.01] rounded-2xl text-xs text-slate-500 font-mono animate-pulse">
                          Detecting active project workspace...
                        </div>
                      )}
                    </div>
                  )}

                  {settingsTab === "permissions" && (
                    <div className="space-y-5">
                      <div className="border-b border-white/5 pb-3">
                        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                          <Shield className="w-4 h-4 text-emerald-400" /> NATIVE SYSTEM PERMISSIONS
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Control which capabilities Liya can access on your local computer.</p>
                      </div>

                      <div className="space-y-4">
                        {Object.entries(permissions).map(([key, perm]: [string, any]) => (
                          <div key={key} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-slate-900/20 border border-white/[0.03] gap-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-bold text-slate-200 capitalize">{key.replace(/([A-Z])/g, " $1")} Actions</span>
                              <span className="text-[9px] font-mono text-slate-500">
                                Current Mode: <strong className={perm.granted ? "text-emerald-400" : perm.requireConfirmation ? "text-amber-400" : "text-red-400"}>
                                  {perm.granted ? "Allowed" : perm.requireConfirmation ? "Ask on Use" : "Blocked"}
                                </strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => setPermissions(prev => ({
                                  ...prev,
                                  [key]: { granted: true, requireConfirmation: false }
                                }))}
                                className={`text-[9px] font-bold font-mono uppercase px-2.5 py-1.5 rounded-lg transition border cursor-pointer ${
                                  perm.granted && !perm.requireConfirmation
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                                    : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                Allow
                              </button>
                              <button
                                onClick={() => setPermissions(prev => ({
                                  ...prev,
                                  [key]: { granted: false, requireConfirmation: true }
                                }))}
                                className={`text-[9px] font-bold font-mono uppercase px-2.5 py-1.5 rounded-lg transition border cursor-pointer ${
                                  perm.requireConfirmation
                                    ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                                    : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                Ask on Use
                              </button>
                              <button
                                onClick={() => setPermissions(prev => ({
                                  ...prev,
                                  [key]: { granted: false, requireConfirmation: false }
                                }))}
                                className={`text-[9px] font-bold font-mono uppercase px-2.5 py-1.5 rounded-lg transition border cursor-pointer ${
                                  !perm.granted && !perm.requireConfirmation
                                    ? "bg-red-500/15 text-red-400 border-red-500/20"
                                    : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                                }`}
                              >
                                Block
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {settingsTab === "skills" && (
                    <div className="space-y-5">
                      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                            <Cpu className="w-4 h-4 text-purple-400 animate-pulse" /> DETERMINISTIC SKILL ENGINE
                          </h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Central registry of core OS abilities bypassed from Gemini to ensure 100% success rates.</p>
                        </div>
                        <button
                          onClick={runRegressionTest}
                          disabled={testingStatus === "running"}
                          className={`text-[9px] uppercase tracking-wider font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/20 shrink-0 cursor-pointer disabled:opacity-50 transition`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${testingStatus === "running" ? "animate-spin" : ""}`} /> 
                          {testingStatus === "running" ? "Testing..." : "Run Regressions"}
                        </button>
                      </div>

                      <div className="space-y-4">
                        {testingStatus !== "idle" && regressionResults && (
                          <div className={`p-4 rounded-xl border ${
                            testingStatus === "success" 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          } flex items-center justify-between font-mono text-xs`}>
                            <div className="flex items-center gap-2">
                              {testingStatus === "success" ? (
                                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                              ) : (
                                <Info className="w-4 h-4 shrink-0 text-red-400" />
                              )}
                              <span>
                                {testingStatus === "success" 
                                  ? `REGRESSION SECURED: All ${regressionResults.results?.length || 0} core system skills verified successfully.`
                                  : "REGRESSION ALERT: Some core functions failed validation."}
                              </span>
                            </div>
                            <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">
                              {testingStatus === "success" ? "100% PASS" : "FAILURES DETECTED"}
                            </span>
                          </div>
                        )}

                        <div className="bg-slate-900/10 border border-white/[0.03] rounded-2xl p-4 space-y-3">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Core Operating System Skills</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-slate-900/20 border border-white/[0.03] rounded-xl flex items-start gap-2.5">
                              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-mono text-xs font-bold">01</div>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block">Open Browser &amp; Navigation</span>
                                <span className="text-[9px] font-mono text-slate-500 block">Open browsers, new tabs, back/forward, URLs.</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-900/20 border border-white/[0.03] rounded-xl flex items-start gap-2.5">
                              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold">02</div>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block">Local App Controller</span>
                                <span className="text-[9px] font-mono text-slate-500 block">Launch Notepad, Calculator, VS Code, Chrome.</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-900/20 border border-white/[0.03] rounded-xl flex items-start gap-2.5">
                              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-mono text-xs font-bold">03</div>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block">Durable File Operations</span>
                                <span className="text-[9px] font-mono text-slate-500 block">Create folder, write file, rename file, delete.</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-900/20 border border-white/[0.03] rounded-xl flex items-start gap-2.5">
                              <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 font-mono text-xs font-bold">04</div>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block">System Clipboard Operations</span>
                                <span className="text-[9px] font-mono text-slate-500 block">Copy text, read clipboard, virtual paste buffering.</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-900/20 border border-white/[0.03] rounded-xl flex items-start gap-2.5">
                              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 font-mono text-xs font-bold">05</div>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block">Window Management</span>
                                <span className="text-[9px] font-mono text-slate-500 block">Minimize, maximize, close, tile windows.</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-900/20 border border-white/[0.03] rounded-xl flex items-start gap-2.5">
                              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 font-mono text-xs font-bold">06</div>
                              <div>
                                <span className="text-xs font-bold text-slate-200 block">System Utilities HUD</span>
                                <span className="text-[9px] font-mono text-slate-500 block">Volume adjusting, mute, brightness dimming, sleep.</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {regressionResults && (
                          <div className="bg-slate-900/15 border border-white/[0.03] rounded-2xl p-4 space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Live Regression Check Log</h4>
                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar font-mono text-[10px]">
                              {regressionResults.results?.map((r: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/20 border border-white/[0.02]">
                                  <div className="flex items-center gap-2">
                                    <span className={r.status === "passed" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                                      {r.status === "passed" ? "✓ PASS" : "✗ FAIL"}
                                    </span>
                                    <span className="text-slate-300">"{r.text}"</span>
                                  </div>
                                  <span className="text-slate-500 font-mono text-[9px]">{r.expected}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Confirmation Modal Dialog */}
      <AnimatePresence>
        {confirmationRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-md p-6 rounded-3xl border border-amber-500/20 bg-slate-900/90 shadow-[0_0_50px_-15px_rgba(245,158,11,0.25)] relative"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full animate-pulse">
                  <Shield className="w-8 h-8 stroke-[1.5]" />
                </div>
                
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-amber-500 uppercase">Local System Action Approval</span>
                  <h3 className="text-base font-semibold text-white">Liya is requesting permission</h3>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-black/30 border border-white/[0.03] p-4 rounded-xl font-mono text-left w-full break-all">
                  {confirmationRequest.message}
                </p>

                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => {
                      confirmationRequest.onCancel();
                      setConfirmationRequest(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white text-xs font-bold font-mono transition cursor-pointer"
                  >
                    DENY ACTION
                  </button>
                  <button
                    onClick={() => {
                      confirmationRequest.onConfirm();
                      setConfirmationRequest(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold font-mono shadow transition cursor-pointer"
                  >
                    APPROVE &amp; RUN
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Footer */}
      <footer className="py-4 border-t border-white/[0.01] bg-slate-950/20 z-10 shrink-0 select-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-600 font-mono text-[8px] tracking-widest uppercase">
          <span>Liya • Voice-First Companion</span>
          <span className="hidden sm:inline">Google Gemini Multimodal Synthesis Engine</span>
        </div>
      </footer>

    </div>
  );
}
