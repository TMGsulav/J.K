import React from "react";
import { motion } from "motion/react";
import { Mic, MicOff, RefreshCw, Volume2, Loader2 } from "lucide-react";

interface VoiceOrbProps {
  state: string;
  inputVolume: number;
  outputVolume: number;
  isMicEnabled: boolean;
  onClick: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  inputVolume,
  outputVolume,
  isMicEnabled,
  onClick,
}) => {
  // Determine color and style scheme based on state
  const getOrbStyle = () => {
    switch (state) {
      case "listening":
        return {
          bg: "bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600",
          shadow: "shadow-[0_0_50px_rgba(6,182,212,0.4)]",
          glowColor: "rgba(6,182,212,0.25)",
        };
      case "speaking":
        return {
          bg: "bg-gradient-to-tr from-violet-500 via-fuchsia-600 to-pink-500",
          shadow: "shadow-[0_0_50px_rgba(168,85,247,0.4)]",
          glowColor: "rgba(168,85,247,0.25)",
        };
      case "connecting":
      case "executing_tool":
      case "thinking":
        return {
          bg: "bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500",
          shadow: "shadow-[0_0_50px_rgba(245,158,11,0.4)]",
          glowColor: "rgba(245,158,11,0.25)",
        };
      case "error":
        return {
          bg: "bg-gradient-to-tr from-red-600 to-rose-800",
          shadow: "shadow-[0_0_50px_rgba(239,68,68,0.4)]",
          glowColor: "rgba(239,68,68,0.25)",
        };
      default: // idle or disconnected
        return {
          bg: "bg-gradient-to-tr from-slate-700 via-slate-800 to-slate-900",
          shadow: "shadow-[0_0_30px_rgba(255,255,255,0.05)]",
          glowColor: "rgba(255,255,255,0.02)",
        };
    }
  };

  const currentStyle = getOrbStyle();
  const volume = state === "listening" ? inputVolume : state === "speaking" ? outputVolume : 0;
  
  // Outer reactive scale
  const reactiveScale = 1 + volume * 0.45;

  return (
    <div className="relative flex flex-col items-center justify-center select-none" id="voice-orb-container">
      {/* Background Ripple Ring 3 (Outer-most) */}
      <motion.div
        animate={
          state === "listening" || state === "speaking"
            ? {
                scale: [1.1, reactiveScale * 2.0, 1.1],
                opacity: [0.1, 0.35, 0.1],
              }
            : {
                scale: [1.1, 1.2, 1.1],
                opacity: [0.03, 0.08, 0.03],
              }
        }
        transition={{
          duration: state === "listening" || state === "speaking" ? 1.6 : 4.0,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-64 h-64 rounded-full border border-dashed pointer-events-none"
        style={{ borderColor: currentStyle.glowColor }}
      />

      {/* Background Ripple Ring 2 (Middle) */}
      <motion.div
        animate={
          state === "listening" || state === "speaking"
            ? {
                scale: [1.0, reactiveScale * 1.5, 1.0],
                opacity: [0.15, 0.5, 0.15],
              }
            : {
                scale: [1.0, 1.12, 1.0],
                opacity: [0.05, 0.12, 0.05],
              }
        }
        transition={{
          duration: state === "listening" || state === "speaking" ? 1.2 : 3.0,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-52 h-52 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${currentStyle.glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* Background Ripple Ring 1 (Inner-most) */}
      <motion.div
        animate={
          state === "listening" || state === "speaking"
            ? {
                scale: [1.0, reactiveScale * 1.25, 1.0],
                opacity: [0.2, 0.65, 0.2],
              }
            : {
                scale: [1.0, 1.05, 1.0],
                opacity: [0.1, 0.2, 0.1],
              }
        }
        transition={{
          duration: state === "listening" || state === "speaking" ? 0.8 : 2.0,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-44 h-44 rounded-full pointer-events-none border border-white/5 shadow-inner"
        style={{ backgroundColor: currentStyle.glowColor }}
      />

      {/* Main Interactive Orb Button */}
      <motion.button
        id="voice-orb-btn"
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        animate={
          state === "listening" || state === "speaking"
            ? { scale: reactiveScale }
            : state === "connecting" || state === "thinking"
            ? { scale: [1.0, 1.04, 1.0] }
            : { scale: 1.0 }
        }
        transition={
          state === "connecting" || state === "thinking"
            ? { duration: 1.0, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 300, damping: 20 }
        }
        className={`w-36 h-36 rounded-full ${currentStyle.bg} ${currentStyle.shadow} border border-white/10 flex flex-col items-center justify-center cursor-pointer z-10 transition-all duration-500 overflow-hidden relative`}
      >
        {/* Subtle glass overlay reflection */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-full h-1/2" />

        {/* Dynamic spinning core for Processing/Thinking */}
        {(state === "connecting" || state === "thinking" || state === "executing_tool") && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-1.5 rounded-full border border-dashed border-white/30 pointer-events-none"
          />
        )}

        {/* Icon representation */}
        <div className="text-white flex flex-col items-center justify-center gap-1.5 relative z-20">
          {state === "disconnected" && (
            <>
              <MicOff className="w-8 h-8 opacity-60 text-slate-300 transition-transform hover:scale-110" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono mt-1">Connect</span>
            </>
          )}

          {state === "connecting" && (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-200 font-mono mt-1">Linking</span>
            </>
          )}

          {state === "listening" && (
            <>
              {isMicEnabled ? (
                <Mic className="w-9 h-9 text-white drop-shadow-md animate-pulse" />
              ) : (
                <MicOff className="w-9 h-9 text-amber-300 drop-shadow-md" />
              )}
              <span className="text-[10px] uppercase font-bold tracking-widest text-blue-100 font-mono mt-1">
                {isMicEnabled ? "Listening" : "Paused"}
              </span>
            </>
          )}

          {state === "thinking" && (
            <>
              <RefreshCw className="w-8 h-8 animate-spin text-amber-100" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-100 font-mono mt-1">Thinking</span>
            </>
          )}

          {state === "executing_tool" && (
            <>
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-100" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-100 font-mono mt-1">Executing</span>
            </>
          )}

          {state === "speaking" && (
            <>
              <Volume2 className="w-9 h-9 text-white drop-shadow-md" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-violet-100 font-mono mt-1">Speaking</span>
            </>
          )}

          {state === "error" && (
            <>
              <MicOff className="w-8 h-8 text-rose-200" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-rose-100 font-mono mt-1">Offline</span>
            </>
          )}
        </div>
      </motion.button>
    </div>
  );
};
