import { useState, useEffect, useRef, useCallback } from "react";
import { AssistantState, LogEntry, ToolCallPayload, SavedSession, SystemPermissions, SimulatedEmotion, ConfirmationRequest } from "../types";
import { DEFAULT_PERMISSIONS } from "../lib/permissions";
import { optimizeQueryAndDestination } from "../lib/research/QueryOptimizer";
import { VoiceManager } from "../lib/research/VoiceManager";


// Helper: Convert Float32Array to PCM 16-bit ArrayBuffer (Little Endian)
function float32ToInt16PCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert PCM16 Base64 to Float32Array for Web Audio playback
function pcmToFloat32(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const buffer = bytes.buffer;
  const dataView = new DataView(buffer);
  const int16Length = Math.floor(buffer.byteLength / 2);
  const float32Array = new Float32Array(int16Length);
  for (let i = 0; i < int16Length; i++) {
    float32Array[i] = dataView.getInt16(i * 2, true) / 32768;
  }
  return float32Array;
}

// Helper: Downsample audio buffer from fromRate to toRate
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  if (fromRate < toRate) return buffer; // shouldn't happen
  const ratio = fromRate / toRate;
  const resultLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(resultLength);
  for (let i = 0; i < resultLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < buffer.length; j++) {
      sum += buffer[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
}

const VALID_TRANSITIONS: Record<AssistantState, AssistantState[]> = {
  disconnected: ["connecting", "error"],
  connecting: ["connected", "disconnected", "error"],
  connected: ["listening", "thinking", "speaking", "executing_tool", "disconnected", "error"],
  listening: ["thinking", "interrupted", "connected", "disconnected", "error"],
  thinking: ["executing_tool", "speaking", "interrupted", "connected", "disconnected", "error"],
  speaking: ["listening", "thinking", "interrupted", "connected", "disconnected", "error"],
  executing_tool: ["thinking", "speaking", "interrupted", "connected", "disconnected", "error"],
  interrupted: ["listening", "thinking", "speaking", "connected", "disconnected", "error"],
  error: ["disconnected", "connecting", "connected"]
};

export function useLiya() {
  const [state, setState] = useState<AssistantState>("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [outputVolume, setOutputVolume] = useState<number>(0);
  const [transcription, setTranscription] = useState<{ user: string; liya: string }>({ user: "", liya: "" });
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [liyaMemory, setLiyaMemory] = useState<any>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [permissions, setPermissions] = useState<SystemPermissions>(DEFAULT_PERMISSIONS);
  const [emotion, setEmotion] = useState<SimulatedEmotion>("neutral");
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);

  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(true);
  const isMicEnabledRef = useRef<boolean>(true);

  // Fetch persistent memory structure from server
  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setLiyaMemory(data);
        }
      }
    } catch (e) {
      console.debug("Failed to load Liya memory (will retry):", e);
    }
  }, []);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  // Load saved sessions from SQLite database
  const fetchSessions = useCallback(async () => {
    try {
      const resp = await fetch("/api/sessions");
      if (resp.ok) {
        const data = await resp.json();
        const formatted: SavedSession[] = data.map((c: any) => ({
          id: c.id,
          title: c.title || "Liya Voice Session",
          timestamp: new Date(c.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          logCount: c.logCount || 0,
          logs: [] // Will fetch messages lazily on demand
        }));
        setSavedSessions(formatted);
      }
    } catch (e) {
      console.error("Failed to fetch sessions from server:", e);
    }
  }, []);

  // Fetch the current active conversation session and load its logs
  const fetchActiveSession = useCallback(async () => {
    try {
      const resp = await fetch("/api/sessions/active");
      if (resp.ok) {
        const data = await resp.json();
        if (data.activeSessionId) {
          setActiveSessionId(data.activeSessionId);
          if (data.logs) {
            const mappedLogs: LogEntry[] = data.logs.map((m: any) => ({
              id: m.id || Math.random().toString(36).substring(2, 9),
              sender: m.sender,
              text: m.text,
              timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isToolCall: false
            }));
            logsRef.current = mappedLogs;
            setLogs(mappedLogs);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch active session from server:", e);
    }
  }, []);

  useEffect(() => {
    fetchActiveSession();
    fetchSessions();

    const handleUpdate = () => {
      fetchMemory();
      fetchSessions();
      fetchActiveSession();
    };
    window.addEventListener("liya-memory-updated", handleUpdate);
    return () => {
      window.removeEventListener("liya-memory-updated", handleUpdate);
    };
  }, [fetchMemory, fetchSessions, fetchActiveSession]);

  const stateRef = useRef<AssistantState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const logsRef = useRef<LogEntry[]>([]);

  // Web Audio Context Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Playback queue and interruption tracking
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const speechTurnActiveRef = useRef<boolean>(true);

  // Keep track of active assistant text chunking
  const activeLiyaUtteranceRef = useRef<string>("");
  const watchdogTimerRef = useRef<any>(null);

  // Log adding helper
  const addLog = useCallback((sender: "user" | "liya" | "system", text: string, isToolCall = false, toolDetails?: any) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      sender,
      text,
      isToolCall,
      toolDetails
    };
    logsRef.current = [newEntry, ...logsRef.current];
    setLogs([...logsRef.current]);
    return newEntry.id;
  }, []);

  // Helpers to update state safely with State Machine Validation and Watchdog Recovery
  const updateState = useCallback((newState: AssistantState) => {
    const currentState = stateRef.current;
    
    // Log transition
    console.log(`[Assistant State] ${currentState} -> ${newState}`);
    
    // Validate state transition to prevent impossible or buggy transitions
    const allowed = VALID_TRANSITIONS[currentState]?.includes(newState) || newState === "disconnected" || newState === "error";
    if (!allowed && currentState !== newState) {
      console.warn(`[State Machine] Invalid transition attempted: ${currentState} -> ${newState}. Sanitizing/allowing for recovery.`);
    }

    // Reset/Clear any active watchdog timers
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }

    // Set new watchdog timer for busy/active states to prevent freezing
    if (newState === "thinking" || newState === "executing_tool") {
      watchdogTimerRef.current = setTimeout(() => {
        console.warn(`[State Watchdog] Assistant stuck in "${newState}" for over 25s. Restoring to "connected".`);
        addLog("system", "⚠️ [System Watchdog] Re-centering busy assistant state to connected.");
        updateState("connected");
      }, 25000);
    } else if (newState === "speaking") {
      watchdogTimerRef.current = setTimeout(() => {
        console.warn(`[State Watchdog] Assistant stuck in "speaking" for over 30s. Restoring to "connected".`);
        updateState("connected");
      }, 30000);
    }

    stateRef.current = newState;
    setState(newState);
  }, [addLog]);

  const updateLogStatus = useCallback((id: string, status: "pending" | "success" | "error", result?: any) => {
    logsRef.current = logsRef.current.map((log) => {
      if (log.id === id || (log.isToolCall && log.toolDetails && log.id === id)) {
        return {
          ...log,
          toolDetails: {
            ...log.toolDetails!,
            status,
            result
          }
        };
      }
      return log;
    });
    setLogs([...logsRef.current]);
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicEnabled((prev) => {
      const newVal = !prev;
      isMicEnabledRef.current = newVal;
      addLog("system", newVal ? "🎤 Microphone active (Listening)" : "🔇 Microphone paused (Stopped listening)");
      return newVal;
    });
  }, [addLog]);

  const saveActiveSession = useCallback(async () => {
    // Force refresh the sessions sidebar to pick up the server's consolidated titles and keywords
    await fetchSessions();
  }, [fetchSessions]);

  const loadSessionLogs = useCallback(async (sessionId: string) => {
    try {
      const resp = await fetch(`/api/sessions/${sessionId}/messages`);
      if (resp.ok) {
        const messages = await resp.json();
        const mappedLogs: LogEntry[] = messages.map((m: any) => ({
          id: m.id || Math.random().toString(36).substring(2, 9),
          sender: m.sender,
          text: m.text,
          timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isToolCall: false
        }));
        
        logsRef.current = mappedLogs;
        setLogs(mappedLogs);
        setActiveSessionId(sessionId);

        // If the websocket is open, close it to let it reconnect with the new session ID!
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
          wsRef.current.close();
        }
      }
    } catch (e) {
      console.error("Failed to load session logs from server:", e);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (resp.ok) {
        await fetchSessions();
        if (activeSessionId === id) {
          setActiveSessionId(null);
          logsRef.current = [];
          setLogs([]);
        }
      }
    } catch (e) {
      console.error("Failed to delete session on server:", e);
    }
  }, [activeSessionId, fetchSessions]);

  const clearHistory = useCallback(async () => {
    try {
      const resp = await fetch("/api/sessions/clear", { method: "POST" });
      if (resp.ok) {
        setSavedSessions([]);
        setActiveSessionId(null);
        logsRef.current = [];
        setLogs([]);
      }
    } catch (e) {
      console.error("Failed to clear history on server:", e);
    }
  }, []);

  // Stop Liya's current voice output immediately (interruption handling)
  const stopPlayback = useCallback(() => {
    console.log("[Liya Client] Stopping playback sources");
    speechTurnActiveRef.current = false;
    
    // Stop local text-to-speech if running
    VoiceManager.getInstance().stop();
    
    activeSourcesRef.current.forEach((source) => {
       try {
         source.stop();
       } catch (e) {
         // Already stopped or not started
       }
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  // Setup Input Audio (Mic 16kHz)
  const setupInputAudio = async () => {
    if (!inputAudioCtxRef.current) {
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (inputAudioCtxRef.current.state === "suspended") {
      await inputAudioCtxRef.current.resume();
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
    const analyser = inputAudioCtxRef.current.createAnalyser();
    analyser.fftSize = 256;
    inputAnalyserRef.current = analyser;

    // Use ScriptProcessor for raw downsampled capture (1024 buffer size for minimal latency)
    const processor = inputAudioCtxRef.current.createScriptProcessor(1024, 1, 1);
    scriptProcessorRef.current = processor;

    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(inputAudioCtxRef.current.destination);

    const nativeSampleRate = inputAudioCtxRef.current.sampleRate;

    processor.onaudioprocess = (e) => {
      // Don't capture when disconnected or in error state
      if (stateRef.current === "disconnected" || stateRef.current === "error") return;
      if (!isMicEnabledRef.current) return;

      const float32 = e.inputBuffer.getChannelData(0);

      // Downsample to 16000Hz programmatically
      const downsampledFloat32 = downsample(float32, nativeSampleRate, 16000);

      // Send PCM base64 data to our server
      const pcm16 = float32ToInt16PCM(downsampledFloat32);
      const base64 = arrayBufferToBase64(pcm16);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "audio", audio: base64 }));
      }
    };
  };

  // Setup Output Audio (Playback 24kHz)
  const setupOutputAudio = () => {
    if (!outputAudioCtxRef.current) {
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!outputAnalyserRef.current) {
      const analyser = outputAudioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      outputAnalyserRef.current = analyser;
      analyser.connect(outputAudioCtxRef.current.destination);
    }
  };

  // Play an incoming PCM audio chunk smoothly using gapless scheduling
  const queueAudioChunk = useCallback((base64Audio: string) => {
    // Shield against pre-interruption chunks bleeding over
    if (!speechTurnActiveRef.current || stateRef.current === "interrupted") {
      console.log("[Liya Client] Skipping audio chunk to prevent pre-interruption bleeding");
      return;
    }

    setupOutputAudio();
    const ctx = outputAudioCtxRef.current!;
    const analyser = outputAnalyserRef.current!;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const float32 = pcmToFloat32(base64Audio);

    // Apply linear fade envelope to eliminate start/end transition clicks and pops
    const fadeSamples = Math.min(128, float32.length / 2);
    for (let i = 0; i < fadeSamples; i++) {
      float32[i] *= (i / fadeSamples);
      float32[float32.length - 1 - i] *= (i / fadeSamples);
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);

    // Transition state to speaking if we are currently connected/listening
    const isNewTurn = stateRef.current !== "speaking" && stateRef.current !== "executing_tool";
    if (isNewTurn) {
      updateState("speaking");
      nextStartTimeRef.current = ctx.currentTime; // Align to exact current time for new response!
    }

    // Schedule gapless playback
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    // Track active sources to stop on interruptions
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0 && stateRef.current === "speaking") {
        updateState("listening");
      }
    };
  }, [updateState]);

  // Execute Gemini Tools (browser-side mock/real effects)
  const executeToolCall = useCallback(async (toolCall: any) => {
    const { name, args, id } = toolCall;
    console.log(`[Liya Client] Executing tool: ${name}`, args);

    const logId = addLog("system", `Liya triggered tool: ${name}`, true, {
      name,
      args,
      status: "pending",
    });

    updateState("executing_tool");

    let success = true;
    let result: any = null;
    const maxRetries = 3;

    // Execution wrapper supporting retry and timeout bounds
    const executeWithRetryAndTimeout = async (attempt = 1): Promise<any> => {
      // Dynamic timeout guard (searchWeb can take longer due to deep research and API retries)
      const timeoutMs = name === "searchWeb" ? 120000 : 8000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out (${timeoutMs}ms threshold reached)`)), timeoutMs)
      );

      const actualExecution = async () => {
        switch (name) {
          case "openWebsite": {
            let url = args.url;
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
              url = "https://" + url;
            }
            
            // Dispatch to Liya OS virtual browser
            window.dispatchEvent(new CustomEvent("liya-open-app", {
              detail: { appName: "Browser" }
            }));
            window.dispatchEvent(new CustomEvent("liya-browser-control", {
              detail: { action: "open", url }
            }));

            // Also fallback to optional browser window
            try {
              window.open(url, "_blank");
            } catch (e) {
              // Ignore popup blocking errors
            }

            return { success: true, openedUrl: url, mode: "immersive_workspace" };
          }

          case "openApplication": {
            const rawApp = args.appName || "Browser";
            let mappedApp = rawApp;

            if (rawApp.match(/vs\s*code|cursor|editor/i)) {
              mappedApp = "VS Code";
              try {
                window.open("vscode://", "_self");
              } catch (e) {}
            } else if (rawApp.match(/spotify|music|player/i)) {
              mappedApp = "Spotify";
              try {
                window.open("spotify://", "_self");
              } catch (e) {}
            } else if (rawApp.match(/calculator|calc/i)) {
              mappedApp = "Calculator";
            } else if (rawApp.match(/chrome|google\s*chrome|browser/i)) {
              mappedApp = "Chrome";
            } else if (rawApp.match(/notepad|scratchpad|notes/i)) {
              mappedApp = "Notepad";
            } else if (rawApp.match(/explorer|folder|file/i)) {
              mappedApp = "File Explorer";
            } else if (rawApp.match(/terminal|cmd|command|powershell|shell|bash/i)) {
              mappedApp = "Command Prompt";
            }

            // Call server OS command launcher API
            try {
              const res = await fetch("/api/launch-app", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appName: mappedApp })
              });
              const data = await res.json();
              if (data.success) {
                addLog("system", `🖥️ Native OS command sent to launch: ${mappedApp}`);
                return { success: true, openedApp: mappedApp, osLaunched: true, message: data.message };
              } else {
                addLog("system", `⚠️ Native OS launch failed for ${mappedApp}: ${data.error || "unknown"}`);
                return { success: false, openedApp: mappedApp, osLaunched: false, error: data.error };
              }
            } catch (err: any) {
              console.error("Failed to trigger local application launch:", err);
              addLog("system", `⚠️ Failed to reach local launch service: ${err.message}`);
              return { success: false, openedApp: mappedApp, error: err.message };
            }
          }

          case "browserNavigation": {
            const action = args.action;
            window.dispatchEvent(new CustomEvent("liya-browser-control", {
              detail: { action }
            }));
            return { success: true, actionExecuted: action };
          }

          case "browserSearch": {
            const rawQuery = args.query;
            const { query: optimizedQuery, url: searchUrl, destinationName } = optimizeQueryAndDestination(rawQuery);

            addLog("liya", "Searching the web...");

            // 1. Open a new browser tab in the user's actual browser
            try {
              window.open(searchUrl, "_blank");
              addLog("system", `🌐 Opened a new tab with ${destinationName} for: "${optimizedQuery}"`);
            } catch (popupErr) {
              console.warn("[Liya Client] Tab popup blocked by browser", popupErr);
              addLog("system", `⚠️ Browser blocked opening a new tab automatically. Click here to see results: ${searchUrl}`);
            }

            // 2. Load search in simulated OS browser
            try {
              window.dispatchEvent(new CustomEvent("liya-open-app", {
                detail: { appName: "Browser" }
              }));
              window.dispatchEvent(new CustomEvent("liya-browser-control", {
                detail: { action: "search", query: optimizedQuery }
              }));
            } catch (err) {
              console.warn("Could not dispatch browser event", err);
            }

            return {
              success: true,
              message: `Opened search results on ${destinationName} for "${optimizedQuery}".`,
              query: optimizedQuery,
              url: searchUrl,
              destination: destinationName
            };
          }

          case "copyToClipboard": {
            await navigator.clipboard.writeText(args.text);
            return { success: true, textCopied: args.text.substring(0, 30) + (args.text.length > 30 ? "..." : "") };
          }

          case "getCurrentTime": {
            const now = new Date();
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const utcOffset = -now.getTimezoneOffset(); // in minutes
            const offsetHours = Math.floor(Math.abs(utcOffset) / 60);
            const offsetMins = Math.abs(utcOffset) % 60;
            const offsetStr = `${utcOffset >= 0 ? "+" : "-"}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;
            return {
              success: true,
              currentTime: now.toLocaleTimeString(),
              currentDate: now.toLocaleDateString(),
              year: now.getFullYear(),
              month: now.toLocaleString('default', { month: 'long' }),
              day: now.getDate(),
              weekday: now.toLocaleString('default', { weekday: 'long' }),
              timeZone,
              utcOffset: offsetStr,
              isoString: now.toISOString(),
            };
          }

          case "readCurrentPage": {
            return {
              success: true,
              title: "Liya Virtual OS Workspace",
              url: window.location.href,
              timestamp: new Date().toISOString(),
              assistantName: "Liya AI",
              activeState: stateRef.current,
            };
          }

          case "searchWeb": {
            const rawQuery = args.query;
            const { query: optimizedQuery, url: searchUrl, destinationName } = optimizeQueryAndDestination(rawQuery);

            addLog("liya", "Searching the web...");

            // 1. Open a new browser tab in the user's actual browser
            try {
              window.open(searchUrl, "_blank");
              addLog("system", `🌐 Opened a new tab with ${destinationName} for: "${optimizedQuery}"`);
            } catch (popupErr) {
              console.warn("[Liya Client] Tab popup blocked by browser", popupErr);
              addLog("system", `⚠️ Browser blocked opening a new tab automatically. Click here to see results: ${searchUrl}`);
            }

            // 2. Load search in simulated OS browser as well
            try {
              window.dispatchEvent(new CustomEvent("liya-open-app", {
                detail: { appName: "Browser" }
              }));
              window.dispatchEvent(new CustomEvent("liya-browser-control", {
                detail: { action: "search", query: optimizedQuery }
              }));
            } catch (err) {
              console.warn("Could not dispatch browser event", err);
            }

            return {
              success: true,
              message: `Opened search results on ${destinationName} for "${optimizedQuery}".`,
              query: optimizedQuery,
              url: searchUrl,
              destination: destinationName,
              results: []
            };
          }

          case "updateLiyaMemory": {
            const { memoryType, updatePayload } = args;
            const response = await fetch("/api/memory", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memoryType, updatePayload }),
            });
            if (!response.ok) {
              throw new Error(`Memory persistence request failed with status ${response.status}`);
            }
            const data = await response.json();
            
            // Dispatch a custom event to notify and refresh memory bindings in the UI
            window.dispatchEvent(new CustomEvent("liya-memory-updated"));
            return { success: true, memoryUpdated: memoryType };
          }

          case "controlApplication":
          case "manageFile":
          case "manageFolder":
          case "manageClipboard":
          case "searchFiles":
          case "manageTextFile":
          case "controlPower":
          case "desktopAutomation": {
            const { runSystemTool } = await import("../lib/systemTools");
            const { determineEmotion } = await import("../lib/emotion");

            const toolResult = await runSystemTool(
              name,
              args,
              permissions,
              (message, onConfirm, onCancel) => {
                setConfirmationRequest({
                  id: Math.random().toString(36).substring(2, 9),
                  toolName: name,
                  args,
                  message,
                  onConfirm,
                  onCancel
                });
              }
            );

            // Set simulated emotion on success or failure
            setEmotion(determineEmotion(stateRef.current, "", toolResult.success));

            if (!toolResult.success) {
              throw new Error(toolResult.message);
            }
            return toolResult;
          }

          default:
            throw new Error(`Tool ${name} is not registered in the system plugins list.`);
        }
      };

      try {
        // Race actual execution against our 8s timeout promise
        return await Promise.race([actualExecution(), timeoutPromise]);
      } catch (err: any) {
        if (attempt < maxRetries) {
          console.warn(`[Liya Client] Tool ${name} failed on attempt ${attempt}. Retrying...`, err);
          return await executeWithRetryAndTimeout(attempt + 1);
        }
        throw err;
      }
    };

    try {
      result = await executeWithRetryAndTimeout();
      addLog("system", `Tool ${name} completed successfully.`);
    } catch (err: any) {
      success = false;
      result = { error: err.message || "Execution limit error" };
      addLog("system", `Tool execution failed completely: ${err.message}`);
    }

    updateLogStatus(logId, success ? "success" : "error", result);

    // Report back to Gemini Live
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "toolResponse",
        id,
        name,
        output: result,
      }));
    }

    // Return to connected/listening mode
    updateState("listening");
  }, [addLog, updateLogStatus, updateState]);

  // Connect to Liya Voice API
  const connect = async (sessionId?: string) => {
    if (stateRef.current !== "disconnected" && stateRef.current !== "error") return;

    if (sessionId) {
      setActiveSessionId(sessionId);
    }
    const sessId = sessionId || activeSessionId;

    updateState("connecting");
    if (!sessId) {
      logsRef.current = [];
      setLogs([]);
    }
    addLog("system", "Initializing Audio Subsystem...");

    try {
      // 1. Setup Audio capture and playback first to get permission
      try {
        await setupInputAudio();
        setIsMicEnabled(true);
        isMicEnabledRef.current = true;
      } catch (micErr: any) {
        console.warn("[Liya Client] Microphone setup/permission failed:", micErr);
        setIsMicEnabled(false);
        isMicEnabledRef.current = false;
        addLog("system", "⚠️ Microphone blocked or unavailable. Keyboard/Text entry mode active (You can still type to converse & hear Liya).");
      }

      try {
        setupOutputAudio();
        if (outputAudioCtxRef.current && outputAudioCtxRef.current.state === "suspended") {
          await outputAudioCtxRef.current.resume();
        }
      } catch (audioOutErr: any) {
        console.warn("[Liya Client] Audio output setup failed:", audioOutErr);
        addLog("system", "⚠️ Audio output setup failed. Voice responses will not be audible.");
      }

      addLog("system", "Connecting to Liya Voice API...");

      // Determine websocket protocol based on location.protocol
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/api/live${sessId ? `?sessionId=${sessId}` : ""}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog("system", "Connection established! Liya is listening...");
        updateState("listening");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "status") {
            if (msg.status === "connected") {
              addLog("system", "Liya Voice Session initialized successfully.");
            } else if (msg.status === "error") {
              addLog("system", `Server error: ${msg.error}`);
              updateState("error");
            }
          }

          if (msg.type === "log") {
            addLog(msg.sender || "system", msg.text);
          }

          if (msg.type === "requestFrame") {
            console.log("[useLiya] Server requested immediate frame capture.");
            window.dispatchEvent(new CustomEvent("liya-request-frame"));
          }

          if (msg.type === "executeLocalTool") {
            const { name, args, id, text } = msg;
            console.log(`[Liya Client] Executing local tool: Name=${name}`, args);
            executeToolCall({ name, args, id });

            if (text) {
              const detectedEmotion = VoiceManager.getInstance().detectEmotionFromText(text);
              setEmotion(detectedEmotion);
              VoiceManager.getInstance().speak(
                text,
                detectedEmotion,
                () => updateState("speaking"),
                () => updateState("listening"),
                (errText) => addLog("system", `⚠️ Voice Lock Alert: ${errText}`)
              );
            }
          }

          if (msg.type === "localResponse") {
            console.log(`[Liya Client] Received local response text: "${msg.text}"`);
            addLog("liya", msg.text);
            setTranscription((prev) => ({
              ...prev,
              liya: msg.text,
            }));

            if (msg.text) {
              const detectedEmotion = VoiceManager.getInstance().detectEmotionFromText(msg.text);
              setEmotion(detectedEmotion);
              VoiceManager.getInstance().speak(
                msg.text,
                detectedEmotion,
                () => updateState("speaking"),
                () => updateState("listening"),
                (errText) => addLog("system", `⚠️ Voice Lock Alert: ${errText}`)
              );
            }

            // Clear transcription preview after a short delay
            setTimeout(() => {
              setTranscription((prev) => {
                if (prev.liya === msg.text) {
                  return { ...prev, ...{ liya: "" } };
                }
                return prev;
              });
            }, 6000);
          }

          if (msg.type === "geminiMessage") {
            const geminiMessage = msg.message;

            // Handle interruption
            if (geminiMessage.serverContent?.interrupted) {
              console.log("[Liya Client] Interrupted by user speaking!");
              stopPlayback();
              updateState("interrupted");
              addLog("system", "Liya was interrupted.");
              setTimeout(() => {
                if (stateRef.current === "interrupted") {
                  updateState("listening");
                }
              }, 500);
            }

            // Handle real-time audio chunk from Gemini
            const parts = geminiMessage.serverContent?.modelTurn?.parts;
            if (parts) {
              if (stateRef.current !== "interrupted") {
                speechTurnActiveRef.current = true;
              }
              for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                  queueAudioChunk(part.inlineData.data);
                }
              }
            }

            // Handle tool/function calling requests
            const toolCall = geminiMessage.toolCall;
            if (toolCall && toolCall.functionCalls) {
              for (const fc of toolCall.functionCalls) {
                executeToolCall(fc);
              }
            }

            // Handle Output audio transcription
            if (geminiMessage.serverContent?.modelTurn?.parts) {
              const textParts = geminiMessage.serverContent.modelTurn.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join(" ");

              if (textParts) {
                activeLiyaUtteranceRef.current += textParts;
                setTranscription((prev) => ({
                  ...prev,
                  liya: activeLiyaUtteranceRef.current,
                }));
                // Synchronize avatar's emotion with the transcription text in real-time
                const detectedEmotion = VoiceManager.getInstance().detectEmotionFromText(activeLiyaUtteranceRef.current);
                setEmotion(detectedEmotion);
              }
            }

            // Reset active Liya text utterance if turn is complete
            if (geminiMessage.serverContent?.turnComplete) {
              if (activeLiyaUtteranceRef.current) {
                addLog("liya", activeLiyaUtteranceRef.current);
                activeLiyaUtteranceRef.current = "";
                setTranscription((prev) => ({ ...prev, liya: "" }));
              }
            }

            // Handle User input audio transcription (what user spoke)
            const userParts = geminiMessage.serverContent?.userTurn?.parts;
            if (userParts) {
              const userText = userParts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join(" ");

              if (userText) {
                setTranscription((prev) => ({
                  ...prev,
                  user: userText,
                }));
                addLog("user", userText);
                // Clear user transcription preview after a short delay
                setTimeout(() => {
                  setTranscription((prev) => {
                    if (prev.user === userText) {
                      return { ...prev, user: "" };
                    }
                    return prev;
                  });
                }, 4000);
              }
            }
          }
        } catch (e) {
          console.error("Error reading WebSocket message:", e);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed", event);
        saveActiveSession();
        cleanup();
        updateState("disconnected");
        addLog("system", "Disconnected from Liya Voice Session.");
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        cleanup();
        updateState("error");
        addLog("system", "Connection error. Please check your network and API secrets.");
      };

    } catch (err: any) {
      console.error("Failed to start session:", err);
      cleanup();
      updateState("error");
      addLog("system", `Failed to start session: ${err.message || "Microphone permission denied or WebSocket issue"}`);
    }
  };

  // Disconnect & Clean up everything
  const disconnect = () => {
    saveActiveSession();
    if (wsRef.current) {
      wsRef.current.close();
    }
    cleanup();
    updateState("disconnected");
    addLog("system", "Liya Voice Session ended.");
  };

  const cleanup = () => {
    stopPlayback();

    // Stop mic capturing stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    inputAnalyserRef.current = null;
    outputAnalyserRef.current = null;
    setInputVolume(0);
    setOutputVolume(0);
  };

  // Real-time animation volumes polling
  useEffect(() => {
    let animId: number;
    const pollVolume = () => {
      // Pull output levels for animating waveform during Liya speaking
      if (outputAnalyserRef.current && stateRef.current === "speaking") {
        const array = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
          sum += array[i];
        }
        const avg = sum / array.length;
        setOutputVolume(avg / 128); // normalize roughly to 0-1
      } else if (stateRef.current !== "speaking") {
        setOutputVolume(0);
      }

      // Pull input levels for animating waveform during user speaking/listening
      if (inputAnalyserRef.current && (stateRef.current === "listening" || stateRef.current === "connecting" || stateRef.current === "connected")) {
        const array = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
        inputAnalyserRef.current.getByteFrequencyData(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
          sum += array[i];
        }
        const avg = sum / array.length;
        setInputVolume(avg / 128); // normalize roughly to 0-1
      } else {
        setInputVolume(0);
      }

      animId = requestAnimationFrame(pollVolume);
    };

    pollVolume();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const clearLiyaMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLiyaMemory(data.memory);
        addLog("system", "🧠 Consolidated memory wiped successfully.");
      }
    } catch (e) {
      console.error("Failed to clear Liya memory:", e);
    }
  }, [addLog]);

  const sendTextMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      stopPlayback();
      wsRef.current.send(JSON.stringify({ type: "text", text }));
      addLog("user", text);
      return true;
    }
    return false;
  }, [addLog, stopPlayback]);

  const sendVideoFrame = useCallback((base64: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "video", video: base64 }));
      return true;
    }
    return false;
  }, []);

  const sendScreenShareStatus = useCallback((active: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "screenShareStatus", active }));
      return true;
    }
    return false;
  }, []);

  const sendVisionQuery = useCallback((text: string, base64: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      stopPlayback();
      wsRef.current.send(JSON.stringify({ type: "visionQuery", text, image: base64 }));
      addLog("user", `${text} 🖥️ [Screen Capture Sent]`);
      return true;
    }
    return false;
  }, [addLog, stopPlayback]);

  return {
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
    toggleMic,
    sendTextMessage,
    sendVideoFrame,
    sendScreenShareStatus,
    sendVisionQuery,
    permissions,
    setPermissions,
    emotion,
    setEmotion,
    confirmationRequest,
    setConfirmationRequest,
    outputAnalyser: outputAnalyserRef.current,
    inputAnalyser: inputAnalyserRef.current,
  };
}
