import React, { useState, useEffect } from "react";
import { Search, ArrowLeft, ArrowRight, RotateCw, Globe, Play, Heart, Bookmark, ExternalLink, Github } from "lucide-react";

interface Tab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
}

interface VirtualBrowserProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
}

export default function VirtualBrowser({ onAddLog, theme }: VirtualBrowserProps) {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "tab1",
      title: "Google Search",
      url: "https://www.google.com",
      history: ["https://www.google.com"],
      historyIndex: 0,
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab1");
  const [inputUrl, setInputUrl] = useState<string>("https://www.google.com");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPlayingYoutubeVideo, setIsPlayingYoutubeVideo] = useState<boolean>(false);
  const [videoPlayTime, setVideoPlayTime] = useState<number>(0);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
    }
  }, [activeTabId, activeTab]);

  // Sync with global custom event listeners for Liya control
  useEffect(() => {
    const handleBrowserControl = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { action, url, query, targetTabId, openInNewTab } = customEvent.detail;
      onAddLog("system", `[Virtual Browser] Received command: ${action}`);

      if (action === "open") {
        let formattedUrl = url || "https://www.google.com";
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
          formattedUrl = "https://" + formattedUrl;
        }

        if (openInNewTab) {
          const newId = "tab_" + Date.now();
          const newTab = {
            id: newId,
            title: getUrlTitle(formattedUrl),
            url: formattedUrl,
            history: [formattedUrl],
            historyIndex: 0
          };
          setTabs(prev => [...prev, newTab]);
          setActiveTabId(newId);
        } else {
          setTabs(prev => prev.map(t => {
            if (t.id === activeTabId) {
              const newHistory = t.history.slice(0, t.historyIndex + 1);
              return {
                ...t,
                title: getUrlTitle(formattedUrl),
                url: formattedUrl,
                history: [...newHistory, formattedUrl],
                historyIndex: newHistory.length
              };
            }
            return t;
          }));
        }
      } else if (action === "close") {
        const idToClose = targetTabId || activeTabId;
        if (tabs.length > 1) {
          const remaining = tabs.filter(t => t.id !== idToClose);
          setTabs(remaining);
          setActiveTabId(remaining[remaining.length - 1].id);
        } else {
          onAddLog("system", "Cannot close the only browser tab.");
        }
      } else if (action === "switch") {
        if (targetTabId) {
          setActiveTabId(targetTabId);
        }
      } else if (action === "back") {
        handleGoBack();
      } else if (action === "forward") {
        handleGoForward();
      } else if (action === "refresh") {
        onAddLog("system", "Refreshed webpage.");
      } else if (action === "search") {
        const q = query || "React Web Development";
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        if (openInNewTab) {
          const newId = "tab_" + Date.now();
          setTabs(prev => [...prev, {
            id: newId,
            title: `Google: ${q}`,
            url: searchUrl,
            history: [searchUrl],
            historyIndex: 0
          }]);
          setActiveTabId(newId);
        } else {
          setTabs(prev => prev.map(t => {
            if (t.id === activeTabId) {
              const newHistory = t.history.slice(0, t.historyIndex + 1);
              return {
                ...t,
                title: `Google: ${q}`,
                url: searchUrl,
                history: [...newHistory, searchUrl],
                historyIndex: newHistory.length
              };
            }
            return t;
          }));
        }
      }
    };

    window.addEventListener("liya-browser-control", handleBrowserControl);
    return () => {
      window.removeEventListener("liya-browser-control", handleBrowserControl);
    };
  }, [tabs, activeTabId, onAddLog]);

  // Video playtime interval simulation
  useEffect(() => {
    let interval: any;
    if (isPlayingYoutubeVideo) {
      interval = setInterval(() => {
        setVideoPlayTime(prev => (prev + 1) % 240);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlayingYoutubeVideo]);

  const getUrlTitle = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtube.com")) return "YouTube";
      if (parsed.hostname.includes("github.com")) return "GitHub";
      if (parsed.hostname.includes("google.com")) {
        if (parsed.searchParams.has("q")) {
          return `Google: ${parsed.searchParams.get("q")}`;
        }
        return "Google Search";
      }
      if (parsed.hostname.includes("react.dev") || parsed.hostname.includes("reactjs.org")) return "React Documentation";
      return parsed.hostname.replace("www.", "");
    } catch {
      return "Webpage";
    }
  };

  const navigateToUrl = (targetUrl: string) => {
    let url = targetUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newHistory = t.history.slice(0, t.historyIndex + 1);
        return {
          ...t,
          title: getUrlTitle(url),
          url,
          history: [...newHistory, url],
          historyIndex: newHistory.length
        };
      }
      return t;
    }));
    onAddLog("system", `Navigated to ${url}`);
  };

  const handleGoBack = () => {
    if (activeTab.historyIndex > 0) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          const newIdx = t.historyIndex - 1;
          return {
            ...t,
            url: t.history[newIdx],
            historyIndex: newIdx
          };
        }
        return t;
      }));
      onAddLog("system", "Navigated back");
    }
  };

  const handleGoForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          const newIdx = t.historyIndex + 1;
          return {
            ...t,
            url: t.history[newIdx],
            historyIndex: newIdx
          };
        }
        return t;
      }));
      onAddLog("system", "Navigated forward");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`;
      navigateToUrl(searchUrl);
    }
  };

  const openNewTab = () => {
    const newId = "tab_" + Date.now();
    setTabs(prev => [...prev, {
      id: newId,
      title: "Google Search",
      url: "https://www.google.com",
      history: ["https://www.google.com"],
      historyIndex: 0
    }]);
    setActiveTabId(newId);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      onAddLog("system", "Cannot close the only open browser tab");
      return;
    }
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      const nextActiveIdx = Math.max(0, idx - 1);
      setActiveTabId(newTabs[nextActiveIdx].id);
    }
  };

  const formatVideoTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // Website Rendering Simulations
  const renderWebContent = () => {
    const url = activeTab.url;

    if (url.includes("youtube.com")) {
      const isLofi = url.toLowerCase().includes("lo-fi") || url.toLowerCase().includes("music");
      return (
        <div className="flex flex-col h-full bg-stone-950 text-slate-100 font-sans select-none overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-white text-sm">▶</div>
              <span className="font-bold tracking-tight text-lg">YouTube</span>
            </div>
            <div className="max-w-md w-full mx-4 bg-white/10 rounded-full py-1.5 px-4 flex items-center">
              <input type="text" placeholder="Search YouTube..." className="bg-transparent text-xs outline-none w-full border-none focus:ring-0 text-white" disabled />
              <Search className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-500/30 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold text-xs">S</div>
          </div>

          {/* Main Video Area */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-y-auto">
            <div className="lg:col-span-8 flex flex-col space-y-4">
              {/* Mock Video Canvas */}
              <div className="aspect-video w-full rounded-2xl bg-stone-900 border border-white/[0.04] overflow-hidden relative flex flex-col justify-between p-4 group">
                <div className="absolute inset-0 bg-radial-gradient(circle_at_center,#22252a_0%,#121316_100%) -z-10" />

                {/* Simulated Waveform or Music visualization */}
                {isPlayingYoutubeVideo ? (
                  <div className="flex-1 flex items-center justify-center space-x-1.5">
                    {[...Array(20)].map((_, i) => {
                      const duration = 0.5 + Math.random() * 0.8;
                      const height = 15 + Math.random() * 75;
                      return (
                        <div
                          key={i}
                          className="w-1.5 rounded-full bg-gradient-to-t from-red-600 to-pink-500 shadow-[0_0_8px_#ef4444]"
                          style={{
                            height: `${height}%`,
                            animation: `bounce ${duration}s ease-in-out infinite alternate`
                          }}
                        />
                      );
                    })}
                    <div className="absolute text-center">
                      <p className="font-mono text-xs text-red-400 font-bold tracking-widest uppercase bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-red-500/20">
                        {isLofi ? "STREAMING LO-FI CHILL BEATS" : "PLAYING VIDEO"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <button
                      onClick={() => setIsPlayingYoutubeVideo(true)}
                      className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transform transition-all hover:scale-105"
                    >
                      <Play className="w-8 h-8 fill-white ml-1" />
                    </button>
                    <p className="text-stone-400 text-xs mt-3 font-medium">Click to Play Broadcast Stream</p>
                  </div>
                )}

                {/* Player Controls */}
                <div className="bg-black/60 backdrop-blur-md p-3.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => setIsPlayingYoutubeVideo(!isPlayingYoutubeVideo)} className="text-white font-bold text-sm">
                      {isPlayingYoutubeVideo ? "⏸ Pause" : "▶ Play"}
                    </button>
                    <span className="text-slate-400 font-mono">{formatVideoTime(videoPlayTime)} / 4:00</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-stone-400 text-[10px] uppercase font-bold font-mono">1080p Stream</span>
                  </div>
                </div>
              </div>

              {/* Title & Metadata */}
              <div>
                <h2 className="text-lg font-bold leading-tight">
                  {isLofi ? "🎵 24/7 Lo-Fi Chill Synthwave Beats for Coding & Focus" : "Ultimate React 19 Guide for Professional Engineers"}
                </h2>
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mt-2 text-xs text-stone-400 font-medium">
                  <div>12,408 watching • Streamed live 14 hours ago</div>
                  <div className="flex space-x-3">
                    <button className="flex items-center gap-1.5 hover:text-white"><Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> 4.8k Likes</button>
                    <button className="flex items-center gap-1.5 hover:text-white"><Bookmark className="w-3.5 h-3.5 text-blue-500 fill-blue-500" /> Save</button>
                  </div>
                </div>
              </div>

              {/* Comments block */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Chat Comments</p>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 text-xs font-medium">
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-blue-400">Aria_Code:</span> This beat is incredibly calming. Perfect for coding my React app.
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-pink-400">Dev_Nirvana:</span> Liya actually navigated here instantly! Incredible!
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-emerald-400">StackOverlord:</span> Listening to this while rewriting my backend schema. Truly fluid.
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar recommendations */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400">Up Next</h3>
              {[
                { title: "Synthwave Beats 🌌", creator: "Liya Beats", views: "140k views" },
                { title: "React Hooks Deep Dive 🎣", creator: "React Dev", views: "1.2M views" },
                { title: "TypeScript Mastery 2026 💻", creator: "TS Core", views: "90k views" }
              ].map((rec, i) => (
                <div key={i} className="flex gap-3 p-2 rounded-xl hover:bg-white/[0.02] cursor-pointer border border-transparent hover:border-white/5 transition-all">
                  <div className="w-20 aspect-video rounded-lg bg-stone-900 flex items-center justify-center font-mono text-[10px] text-stone-500 border border-white/10">PREVIEW</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{rec.title}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{rec.creator}</p>
                    <p className="text-[10px] text-stone-500 mt-0.5">{rec.views}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (url.includes("github.com")) {
      return (
        <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] font-sans overflow-y-auto select-none">
          {/* Header */}
          <div className="px-6 py-4 bg-[#161b22] border-b border-[#21262d] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Github className="w-6 h-6 text-white" />
              <span className="font-bold text-white text-sm">GitHub</span>
              <span className="bg-[#30363d] px-2 py-0.5 rounded-full text-[10px] border border-[#21262d] font-semibold">Public</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="bg-[#238636] text-white px-3 py-1 rounded-md font-semibold hover:bg-[#2ea043] cursor-pointer">Follow</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Repo Info */}
            <div className="flex items-center space-x-3 border-b border-[#21262d] pb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white text-base">L</div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                  liya-assistant / <span className="text-blue-400">liya-os-workspace</span>
                </h2>
                <p className="text-xs text-[#8b949e] mt-1">A real-time voice-to-voice OS assistant power-module using Gemini 3.1 Live API.</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 font-mono text-center text-xs">
              <div className="bg-[#161b22] p-3 rounded-xl border border-[#21262d]">
                <div className="font-bold text-white text-sm">4.9k</div>
                <div className="text-[#8b949e] text-[10px]">Stars</div>
              </div>
              <div className="bg-[#161b22] p-3 rounded-xl border border-[#21262d]">
                <div className="font-bold text-white text-sm">128</div>
                <div className="text-[#8b949e] text-[10px]">Forks</div>
              </div>
              <div className="bg-[#161b22] p-3 rounded-xl border border-[#21262d]">
                <div className="font-bold text-white text-sm">0</div>
                <div className="text-[#8b949e] text-[10px]">Issues</div>
              </div>
            </div>

            {/* Code Directory list */}
            <div className="border border-[#21262d] rounded-xl overflow-hidden text-xs">
              <div className="bg-[#161b22] px-4 py-3 border-b border-[#21262d] font-bold text-white flex justify-between">
                <span>Latest Commit: Refactored Live Audio Pipeline</span>
                <span className="text-[#8b949e] font-mono font-normal">2 hours ago</span>
              </div>
              {[
                { name: "src/hooks/useLiya.ts", desc: "Added queue protection and click-free fading", size: "26.4 KB" },
                { name: "server.ts", desc: "Upgraded Live Connection & secure Tool Registry", size: "31.8 KB" },
                { name: "src/components/LiyaOS.tsx", desc: "Integrated multi-window virtual OS environment", size: "18.2 KB" },
                { name: "package.json", desc: "Configured build directives for esbuild node bundle", size: "1.1 KB" }
              ].map((file, idx) => (
                <div key={idx} className="px-4 py-3 border-b border-[#21262d] last:border-0 hover:bg-[#161b22] flex items-center justify-between transition-colors">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400">📄</span>
                    <span className="font-mono text-white font-semibold">{file.name}</span>
                    <span className="text-[#8b949e] truncate max-w-[200px] sm:max-w-xs">{file.desc}</span>
                  </div>
                  <span className="text-[#8b949e] font-mono">{file.size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (url.includes("react.dev") || url.includes("reactjs.org")) {
      return (
        <div className="flex flex-col h-full bg-[#1c1c1e] text-[#f2f2f7] font-sans overflow-y-auto select-none">
          {/* Top Panel */}
          <div className="px-6 py-4 bg-[#2c2c2e] border-b border-[#3a3a3c] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm animate-spin-slow">⚛</div>
              <span className="font-bold tracking-tight text-white text-sm">React Documentation</span>
            </div>
            <span className="bg-cyan-500/10 text-cyan-400 px-2.5 py-0.5 rounded-full text-[10px] font-mono border border-cyan-500/20">React 19 Core</span>
          </div>

          <div className="p-6 space-y-5">
            <h2 className="text-xl font-bold tracking-tight text-white">Advanced React Hooks Reference</h2>
            <p className="text-stone-400 text-xs leading-relaxed">
              React Hooks let you use different state and other React features from your components. This section details native APIs and best practices for audio rendering and real-time streams.
            </p>

            <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.02] space-y-2 text-xs">
              <h3 className="font-bold text-cyan-400 flex items-center gap-1">⚡ hook: useAudioScheduler</h3>
              <p className="text-stone-300">
                To guarantee gapless audio rendering when receiving continuous PCM chunks over a network stream, use precise AudioContext timers instead of React re-render states.
              </p>
              <pre className="p-3 rounded-lg bg-black/40 font-mono text-[10px] text-cyan-300 border border-white/[0.04] overflow-x-auto">
{`// Keep track of the precise starting timestamp for the next buffer
const nextStartTimeRef = useRef(0);

const queueChunk = (float32Array) => {
  const ctx = audioContextRef.current;
  const buffer = ctx.createBuffer(1, float32Array.length, 24000);
  buffer.copyToChannel(float32Array, 0);
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  
  const now = ctx.currentTime;
  const start = Math.max(now, nextStartTimeRef.current);
  source.start(start);
  nextStartTimeRef.current = start + buffer.duration;
};`}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    if (url.includes("google.com/search") || searchQuery) {
      const q = new URL(url).searchParams.get("q") || searchQuery || "React development";
      return (
        <div className={`flex flex-col h-full font-sans overflow-y-auto select-none ${
          theme === "premium-light" ? "bg-stone-50 text-stone-800" : "bg-slate-950 text-slate-100"
        }`}>
          <div className={`px-6 py-4 border-b ${
            theme === "premium-light" ? "bg-white border-stone-200" : "bg-black/20 border-white/[0.04]"
          } flex items-center justify-between`}>
            <span className="font-bold text-sm">Google Search Results</span>
            <span className="text-[10px] font-mono opacity-60">Query: "{q}"</span>
          </div>

          <div className="p-6 space-y-6">
            <p className="text-xs opacity-60">About 2,340,000 results (0.12 seconds)</p>

            {[
              {
                title: "Official React Documentation - react.dev",
                snippet: "React lets you build user interfaces out of individual pieces called components. Create your own React components like Thumbnail, LikeButton, and Video...",
                target: "https://react.dev"
              },
              {
                title: "Liya OS Workspace Module - github.com",
                snippet: "A custom operating system shell built inside a web sandbox leveraging modular plugins, file indices, and real-time diagnostics...",
                target: "https://github.com/liya-assistant/liya-os-workspace"
              },
              {
                title: "Lo-Fi Beats stream - youtube.com",
                snippet: "Chill lo-fi music livestream designed to improve focus, concentration, and spatial coding awareness for developers...",
                target: "https://www.youtube.com/watch?q=lo-fi+beats"
              }
            ].map((res, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${
                theme === "premium-light"
                  ? "bg-white border-stone-200 hover:border-blue-300"
                  : "bg-white/[0.01] border-white/[0.04] hover:border-blue-500/20"
              } transition-all cursor-pointer`} onClick={() => navigateToUrl(res.target)}>
                <div className="text-[11px] text-blue-500 font-medium truncate flex items-center gap-1">
                  <span>{res.target}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
                <h3 className="text-sm font-bold text-blue-600 hover:underline mt-0.5 leading-snug">{res.title}</h3>
                <p className={`text-xs mt-1 leading-relaxed ${
                  theme === "premium-light" ? "text-stone-600" : "text-stone-400"
                }`}>{res.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (url === "https://www.google.com" || url === "https://google.com") {
      return (
        <div className={`flex flex-col h-full items-center justify-center font-sans select-none p-6 ${
          theme === "premium-light" ? "bg-stone-50 text-stone-800" : "bg-slate-950 text-slate-100"
        }`}>
          <div className="text-center max-w-md w-full space-y-6">
            <h1 className="text-4xl font-black tracking-tighter">
              G<span className="text-red-500">o</span><span className="text-yellow-500">o</span>g<span className="text-emerald-500">l</span>e
            </h1>
            <form onSubmit={handleSearch} className="flex bg-white/10 dark:bg-black/40 border border-stone-300 dark:border-white/10 rounded-full py-2.5 px-5 shadow-sm items-center">
              <input
                type="text"
                placeholder="Search Google or type a URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs outline-none border-none focus:ring-0 w-full text-stone-800 dark:text-white"
              />
              <button type="submit" className="p-1 hover:bg-stone-200/50 dark:hover:bg-white/5 rounded-full outline-none">
                <Search className="w-4 h-4 text-slate-400" />
              </button>
            </form>
            <div className="flex justify-center gap-3 text-[11px] text-blue-500 font-medium">
              <button onClick={() => navigateToUrl("https://youtube.com")} className="hover:underline">YouTube</button>
              <span>•</span>
              <button onClick={() => navigateToUrl("https://github.com")} className="hover:underline">GitHub</button>
              <span>•</span>
              <button onClick={() => navigateToUrl("https://react.dev")} className="hover:underline">React Docs</button>
            </div>
          </div>
        </div>
      );
    }

    // Default Web view mock for other URLs
    return (
      <div className={`flex flex-col h-full items-center justify-center font-sans text-center p-6 select-none ${
        theme === "premium-light" ? "bg-stone-50 text-stone-800" : "bg-slate-950 text-slate-100"
      }`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          theme === "premium-light" ? "bg-stone-100 border border-stone-200" : "bg-white/[0.02] border border-white/[0.04]"
        }`}>
          <Globe className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-base font-bold text-stone-800 dark:text-white leading-tight">Virtual Page Loaded Successfully</h2>
        <p className="text-xs text-stone-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed font-medium">
          Liya OS successfully resolved domain <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/5 font-semibold text-blue-400">{url}</span>. Full-scale mock container active.
        </p>
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigateToUrl("https://google.com")} className="px-3.5 py-1.5 text-[10px] font-mono tracking-widest uppercase bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-bold">Go Home</button>
          <button onClick={() => onAddLog("system", "Test ping sent to external mock host")} className="px-3.5 py-1.5 text-[10px] font-mono tracking-widest uppercase bg-white/10 dark:bg-black/30 text-stone-600 dark:text-slate-400 border border-stone-300 dark:border-white/10 rounded-xl hover:bg-white/5 font-bold">Test Ping</button>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl overflow-hidden border ${
      theme === "premium-light" ? "bg-stone-100 border-stone-200" : "bg-slate-900 border-slate-800"
    }`}>
      {/* Tab Strip */}
      <div className={`px-3 pt-2 pb-0 flex items-end gap-1.5 border-b select-none ${
        theme === "premium-light" ? "bg-stone-100 border-stone-200" : "bg-[#0c0f16] border-slate-800"
      }`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-sans font-medium rounded-t-xl border cursor-pointer max-w-[140px] truncate transition-all duration-200 ${
                isActive
                  ? (theme === "premium-light" ? "bg-white border-stone-200 border-b-transparent text-stone-900" : "bg-slate-900 border-slate-800 border-b-transparent text-white")
                  : (theme === "premium-light" ? "border-transparent bg-stone-200/50 hover:bg-stone-200 text-stone-500" : "border-transparent bg-[#141822] hover:bg-[#1a202d] text-slate-400")
              }`}
            >
              <Globe className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="truncate">{tab.title}</span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="hover:bg-red-500/10 hover:text-red-500 rounded p-0.5 text-[9px] shrink-0 font-bold font-mono"
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          onClick={openNewTab}
          className={`p-1 rounded-lg border text-[11px] font-bold outline-none mb-1 cursor-pointer transition-colors ${
            theme === "premium-light" ? "border-stone-200 bg-white hover:bg-stone-50 text-stone-600" : "border-slate-800 bg-[#141822] hover:bg-slate-800 text-slate-300"
          }`}
          title="Open New Tab"
        >
          ＋
        </button>
      </div>

      {/* Nav Controls Bar */}
      <div className={`px-4 py-2.5 flex items-center gap-3 border-b select-none ${
        theme === "premium-light" ? "bg-white border-stone-200" : "bg-slate-900 border-slate-800"
      }`}>
        <div className="flex items-center gap-1">
          <button
            onClick={handleGoBack}
            disabled={activeTab.historyIndex === 0}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleGoForward}
            disabled={activeTab.historyIndex === activeTab.history.length - 1}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-40"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onAddLog("system", "Webpage refreshed.")}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Address Bar */}
        <div className="flex-1">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigateToUrl(inputUrl);
              }
            }}
            className={`w-full py-1 px-3 text-xs outline-none rounded-xl border font-sans font-medium transition-all ${
              theme === "premium-light"
                ? "bg-stone-50 border-stone-200 focus:bg-white text-stone-800 focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                : "bg-black/30 border-white/[0.04] focus:bg-black/50 text-slate-300 focus:border-slate-700"
            }`}
          />
        </div>

        {/* Quick Bookmarks */}
        <div className="flex gap-2 text-[10px] font-mono tracking-widest font-bold">
          <button onClick={() => navigateToUrl("https://youtube.com")} className="flex items-center gap-1 px-2 py-1 rounded bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/10 transition-colors">
            <Bookmark className="w-2.5 h-2.5 fill-red-400" />
            YOUTUBE
          </button>
          <button onClick={() => navigateToUrl("https://github.com")} className="flex items-center gap-1 px-2 py-1 rounded bg-stone-700/20 hover:bg-stone-700/30 text-slate-300 border border-slate-500/10 transition-colors">
            <Bookmark className="w-2.5 h-2.5 fill-slate-300" />
            GITHUB
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 bg-white dark:bg-slate-950 overflow-hidden relative">
        {renderWebContent()}
      </div>
    </div>
  );
}
