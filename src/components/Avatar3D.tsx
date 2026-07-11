import React, { useEffect, useRef, useState } from "react";
import { AssistantState, SimulatedEmotion } from "../types";

interface Avatar3DProps {
  state: AssistantState;
  inputVolume: number;
  outputVolume: number;
  onConnect: () => void;
  onDisconnect: () => void;
  outputAnalyser: AnalyserNode | null;
  theme?: "immersive-dark" | "premium-light";
  emotion?: SimulatedEmotion;
}

const EMOTION_THEMES: Record<string, {
  glow: string;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}> = {
  neutral: {
    glow: "rgba(148, 163, 184, 0.25)",
    label: "Calm & Attentive",
    badgeBg: "bg-slate-950/70",
    badgeBorder: "border-slate-800",
    badgeText: "text-slate-400",
  },
  thinking: {
    glow: "rgba(139, 92, 246, 0.45)",
    label: "Reflective thinking",
    badgeBg: "bg-purple-950/60",
    badgeBorder: "border-purple-800/40",
    badgeText: "text-purple-300 animate-pulse",
  },
  confident: {
    glow: "rgba(245, 158, 11, 0.45)",
    label: "Confident analysis",
    badgeBg: "bg-amber-950/60",
    badgeBorder: "border-amber-800/40",
    badgeText: "text-amber-300",
  },
  empathetic: {
    glow: "rgba(6, 182, 212, 0.45)",
    label: "Empathetic active-listening",
    badgeBg: "bg-cyan-950/60",
    badgeBorder: "border-cyan-800/40",
    badgeText: "text-cyan-300",
  },
  excited: {
    glow: "rgba(244, 63, 94, 0.55)",
    label: "Energetic & Inspired",
    badgeBg: "bg-rose-950/60",
    badgeBorder: "border-rose-800/40",
    badgeText: "text-rose-300",
  },
  celebrating: {
    glow: "rgba(16, 185, 129, 0.55)",
    label: "Celebrating success!",
    badgeBg: "bg-emerald-950/60",
    badgeBorder: "border-emerald-800/40",
    badgeText: "text-emerald-300",
  },
  disappointed: {
    glow: "rgba(249, 115, 22, 0.4)",
    label: "Disappointed",
    badgeBg: "bg-orange-950/60",
    badgeBorder: "border-orange-800/40",
    badgeText: "text-orange-300",
  },
  sad: {
    glow: "rgba(59, 130, 246, 0.4)",
    label: "Empathetic comfort",
    badgeBg: "bg-blue-950/60",
    badgeBorder: "border-blue-800/40",
    badgeText: "text-blue-300",
  }
};

export const Avatar3D: React.FC<Avatar3DProps> = ({
  state,
  inputVolume,
  outputVolume,
  emotion = "neutral",
}) => {
  // Avatar State Machine Transitions
  const [currentAnim, setCurrentAnim] = useState<"idle" | "thinking" | "talking">("idle");

  // Preloaded Blob URL cache
  const [blobUrls, setBlobUrls] = useState<{
    idle: string;
    thinking: string;
    talking: string;
  } | null>(null);
  const [preloading, setPreloading] = useState<boolean>(true);
  const [preloadProgress, setPreloadProgress] = useState<number>(0);

  // Hidden preload video element ref for triggering hardware decoding pre-warm
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);

  // HTML5 Video Elements for each state
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const thinkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Sequentially fetch all three state videos as Blobs and create memory cache ObjectURLs
  useEffect(() => {
    let isMounted = true;
    const paths = {
      idle: "/assets/avatar/anime_girl_standing.mp4",
      thinking: "/assets/avatar/anime_girl_thinking.mp4",
      talking: "/assets/avatar/anime_girl_talking.mp4",
    };

    const preloadAllVideos = async () => {
      try {
        const cachedUrls: Record<string, string> = {};
        const keys = ["idle", "thinking", "talking"] as const;

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const response = await fetch(paths[key]);
          if (!response.ok) throw new Error(`HTTP error ${response.status} fetching ${key}`);
          
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          cachedUrls[key] = blobUrl;

          // Push to the hidden preloading video element to force browser parsing/caching
          if (preloadVideoRef.current) {
            preloadVideoRef.current.src = blobUrl;
            preloadVideoRef.current.load();
          }

          if (isMounted) {
            setPreloadProgress(Math.round(((i + 1) / keys.length) * 100));
          }
        }

        if (isMounted) {
          setBlobUrls({
            idle: cachedUrls.idle,
            thinking: cachedUrls.thinking,
            talking: cachedUrls.talking,
          });
          setPreloading(false);
        }
      } catch (err) {
        console.error("[Avatar3D] Video Blob preloading failed. Falling back to direct streaming:", err);
        // Fallback to static relative paths directly if Fetch fails (e.g. offline dev mode)
        if (isMounted) {
          setBlobUrls(paths);
          setPreloading(false);
        }
      }
    };

    preloadAllVideos();

    return () => {
      isMounted = false;
      // Clean up cached Object URLs to prevent memory leaks when component unmounts
      if (blobUrls) {
        (Object.values(blobUrls) as string[]).forEach((url) => {
          if (url.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
        });
      }
    };
  }, []);

  // Sync state machine to animation source
  useEffect(() => {
    let nextAnim: "idle" | "thinking" | "talking" = "idle";
    if (state === "speaking") {
      nextAnim = "talking";
    } else if (state === "thinking" || state === "executing_tool") {
      nextAnim = "thinking";
    } else {
      nextAnim = "idle";
    }

    if (nextAnim !== currentAnim) {
      setCurrentAnim(nextAnim);
    }
  }, [state, currentAnim]);

  // Keep all videos playing in background so state transitions are instantaneous and seamless
  useEffect(() => {
    if (preloading || !blobUrls) return;

    const playAll = () => {
      const videos = [idleVideoRef.current, thinkingVideoRef.current, talkingVideoRef.current];
      videos.forEach((v) => {
        if (v) {
          v.muted = true;
          v.playsInline = true;
          v.loop = true;
          v.play().catch((e) => {
            console.debug("Autoplay deferred:", e.message);
          });
        }
      });
    };

    playAll();

    // Periodic check to make sure they remain playing in low power modes
    const interval = setInterval(playAll, 1500);
    return () => clearInterval(interval);
  }, [preloading, blobUrls]);

  // Calculate dynamic responsive glow intensity in sync with active vocal volume
  const volume = state === "speaking" ? outputVolume : state === "listening" ? inputVolume : 0;
  const activeTheme = EMOTION_THEMES[emotion] || EMOTION_THEMES.neutral;
  const glowShadow = `0 0 ${25 + volume * 180}px ${activeTheme.glow}`;

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-[420px] aspect-square rounded-[32px] overflow-hidden border border-white/10 bg-slate-950 transition-all duration-300 flex items-center justify-center"
        style={{
          boxShadow: glowShadow,
          transform: `scale(${1.0 + volume * 0.04})`,
        }}
      >
        {/* Floating Emotion HUD Status Badge */}
        {!preloading && (
          <div className={`absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg select-none transition-all duration-300 ${activeTheme.badgeBg} ${activeTheme.badgeBorder}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${activeTheme.badgeText} animate-pulse`} />
            <span className="text-[8px] font-mono tracking-[2px] uppercase font-bold text-slate-200">
              {emotion}
            </span>
          </div>
        )}

        {/* Hidden video ref used for preloading and parsing Blob objects */}
        <video
          ref={preloadVideoRef}
          style={{ display: "none" }}
          muted
          playsInline
          preload="auto"
        />

        {preloading ? (
          /* High quality premium glassmorphic loader during Blob fetch phase */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-slate-950/80 backdrop-blur-md z-30 transition-all duration-500">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin" />
              <div className="absolute inset-2 rounded-full border-b-2 border-indigo-500 animate-spin animate-reverse" />
              <span className="text-[10px] font-mono font-bold text-blue-400">{preloadProgress}%</span>
            </div>
            <p className="text-xs font-light tracking-[3px] uppercase text-slate-300">Caching Liya Core</p>
            <p className="text-[9px] font-mono text-slate-500 mt-2 tracking-wider">PRELOADING HI-FI CHANNELS</p>
          </div>
        ) : (
          blobUrls && (
            <>
              {/* Idle Video Loop */}
              <video
                ref={idleVideoRef}
                src={blobUrls.idle}
                loop
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                  currentAnim === "idle" ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
                preload="auto"
              />

              {/* Thinking Video Loop */}
              <video
                ref={thinkingVideoRef}
                src={blobUrls.thinking}
                loop
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                  currentAnim === "thinking" ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
                preload="auto"
              />

              {/* Talking/Speaking Video Loop */}
              <video
                ref={talkingVideoRef}
                src={blobUrls.talking}
                loop
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                  currentAnim === "talking" ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
                preload="auto"
              />
            </>
          )
        )}

        {/* Subtle holographic/digital scanlines for a premium tech touch */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-5 z-20"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.8) 0px, rgba(0,0,0,0.8) 1px, transparent 1px, transparent 4px)",
          }}
        />

        {/* Vignette effect for visual depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.45)_100%)] pointer-events-none z-25" />
      </div>
    </div>
  );
};
