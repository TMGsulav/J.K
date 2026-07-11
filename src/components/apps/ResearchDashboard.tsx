import React, { useState, useEffect, useCallback } from "react";
import { 
  Activity, Chrome, Trash2, StopCircle, RefreshCw, 
  Database, Clock, CheckCircle, XCircle, Search, 
  ExternalLink, Sparkles, BookOpen, Layers, Zap
} from "lucide-react";

interface ResearchSessionLog {
  query: string;
  timestamp: number;
  duration: number;
  success: boolean;
  sourcesCount: number;
  engineUsed: string;
  visitedUrls: string[];
}

interface BrowserDashboardState {
  browserStatus: "closed" | "launching" | "ready" | "busy" | "error";
  currentPage: string | null;
  visitedUrls: string[];
  cacheStats: {
    searchEntries: number;
    pageEntries: number;
  };
  researchHistory: ResearchSessionLog[];
  stats: {
    successRate: number;
    avgTimeMs: number;
    totalResearchCount: number;
    geminiRequests: number;
    estimatedTokens: number;
    memoryUsageMb: number;
  };
}

interface ResearchDashboardProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
  theme: "immersive-dark" | "premium-light";
}

export default function ResearchDashboard({ onAddLog, theme }: ResearchDashboardProps) {
  const [dashboard, setDashboard] = useState<BrowserDashboardState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchDashboardState = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch("/api/research/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard metrics");
      const data = await res.json();
      setDashboard(data);
      setError(null);
    } catch (err: any) {
      console.error("[ResearchDashboard] Fetch error:", err);
      setError(err.message || "Could not load research engine dashboard metrics.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const [screenshotTime, setScreenshotTime] = useState<number>(Date.now());

  // Poll for live metrics every 2 seconds
  useEffect(() => {
    fetchDashboardState(true);
    const interval = setInterval(() => {
      fetchDashboardState(false);
      setScreenshotTime(Date.now());
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchDashboardState]);

  const handleCloseBrowser = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/research/close", { method: "POST" });
      if (res.ok) {
        onAddLog("system", "Manually closed autonomous Playwright browser process.");
        fetchDashboardState();
      }
    } catch (e: any) {
      onAddLog("system", `Failed to close browser process: ${e.message}`);
    }
  };

  const handleClearCache = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/research/clear-cache", { method: "POST" });
      if (res.ok) {
        onAddLog("system", "Search Cache & Webpage pageCache cleared successfully.");
        fetchDashboardState();
      }
    } catch (e: any) {
      onAddLog("system", `Failed to clear research cache: ${e.message}`);
    }
  };

  const isDark = theme === "immersive-dark";

  if (isLoading && !dashboard) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 ${isDark ? "bg-slate-950 text-slate-300" : "bg-stone-50 text-stone-800"}`}>
        <RefreshCw className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
        <p className="text-sm font-medium">Connecting to Autonomous Research Server...</p>
      </div>
    );
  }

  const stats = dashboard?.stats || {
    successRate: 100,
    avgTimeMs: 0,
    totalResearchCount: 0,
    geminiRequests: 0,
    estimatedTokens: 0,
    memoryUsageMb: 0
  };

  const cacheStats = dashboard?.cacheStats || { searchEntries: 0, pageEntries: 0 };
  const status = dashboard?.browserStatus || "closed";
  const currentPage = dashboard?.currentPage || "None";
  const visitedUrls = dashboard?.visitedUrls || [];
  const history = dashboard?.researchHistory || [];

  return (
    <div className={`h-full flex flex-col overflow-y-auto ${isDark ? "bg-slate-950 text-slate-100" : "bg-stone-50 text-stone-900"}`}>
      {/* Upper Control Bar */}
      <div className={`px-5 py-4 flex flex-wrap items-center justify-between border-b ${isDark ? "border-slate-800 bg-slate-900" : "border-stone-200 bg-stone-100/50"}`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isDark ? "bg-slate-800 text-cyan-400" : "bg-stone-200 text-cyan-600"}`}>
            <Chrome className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Liya Playwright Research Engine</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Autonomous multi-engine web crawler & reader</p>
          </div>
        </div>

        {/* Browser Status Pill & Controls */}
        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            status === "ready" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
            status === "busy" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
            status === "launching" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
            status === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
            "bg-slate-500/10 text-slate-400 border border-slate-500/20"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              status === "ready" ? "bg-emerald-400 animate-pulse" :
              status === "busy" ? "bg-amber-400 animate-spin" :
              status === "launching" ? "bg-cyan-400 animate-bounce" :
              status === "error" ? "bg-red-500" :
              "bg-slate-500"
            }`} />
            <span className="capitalize">{status}</span>
          </div>

          <button 
            onClick={() => fetchDashboardState(true)} 
            disabled={isRefreshing}
            className={`p-2 rounded-md border text-xs font-medium flex items-center space-x-1 transition ${
              isDark 
                ? "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800" 
                : "border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>

          <button 
            onClick={handleCloseBrowser} 
            disabled={status === "closed"}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition ${
              status === "closed"
                ? "opacity-40 cursor-not-allowed bg-slate-800 text-slate-500"
                : "bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30"
            }`}
          >
            <StopCircle className="w-3.5 h-3.5" />
            <span>Kill Session</span>
          </button>
        </div>
      </div>

      {/* Main Grid Dashboard */}
      <div className="p-5 space-y-5">
        
        {/* Active URL Status Box */}
        <div className={`p-4 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
          <div className="flex items-center space-x-2.5 mb-2">
            <Chrome className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current Active Webpage / Scraper Stage</span>
          </div>
          <p className="text-sm font-mono truncate select-all text-cyan-500">
            {currentPage}
          </p>
        </div>

        {/* Live Browser View (Real-time Stream) */}
        {status !== "closed" && (
          <div className={`p-4 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <Chrome className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Live Browser View (Real-time Stream)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 animate-pulse">LIVE SCREEN</span>
            </div>
            <div className={`relative aspect-video w-full max-w-3xl mx-auto rounded-lg overflow-hidden border ${isDark ? "border-slate-800 bg-slate-950" : "border-stone-200 bg-stone-100"}`}>
              <img 
                src={`/live_research.png?t=${screenshotTime}`} 
                alt="Live browser research viewport" 
                className="w-full h-full object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/75 text-[10px] font-mono text-white flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="truncate max-w-[250px]">{currentPage}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2x3 Bento Grid for Core Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <span className="text-xs font-medium text-slate-500">Success Rate</span>
            <div className="flex items-baseline space-x-1 mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-500">{stats.successRate}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${stats.successRate}%` }}></div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <span className="text-xs font-medium text-slate-500">Avg Research Duration</span>
            <div className="flex items-baseline space-x-1 mt-2">
              <span className="text-2xl font-bold font-mono text-cyan-500">
                {stats.avgTimeMs > 0 ? (stats.avgTimeMs / 1000).toFixed(1) : "0"}s
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Target &lt; 5s per query
            </span>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <span className="text-xs font-medium text-slate-500">Queries Executed</span>
            <div className="flex items-baseline space-x-1 mt-2">
              <span className="text-2xl font-bold font-mono text-indigo-500">{stats.totalResearchCount}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 flex items-center">
              <Zap className="w-3 h-3 mr-1 text-indigo-500" />
              Real-time deep research
            </span>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <span className="text-xs font-medium text-slate-500">Gemini Requests</span>
            <div className="flex items-baseline space-x-1 mt-2">
              <span className="text-2xl font-bold font-mono text-purple-500">{stats.geminiRequests}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 flex items-center">
              <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
              Limited to max 1 per query
            </span>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <span className="text-xs font-medium text-slate-500">Estimated Tokens</span>
            <div className="flex items-baseline space-x-1 mt-2">
              <span className="text-2xl font-bold font-mono text-pink-500">
                {stats.estimatedTokens > 1000 ? `${(stats.estimatedTokens / 1000).toFixed(1)}k` : stats.estimatedTokens}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 flex items-center">
              <BookOpen className="w-3 h-3 mr-1 text-pink-500" />
              Extracted GFM clean text
            </span>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <span className="text-xs font-medium text-slate-500">Heap Memory Used</span>
            <div className="flex items-baseline space-x-1 mt-2">
              <span className="text-2xl font-bold font-mono text-amber-500">{stats.memoryUsageMb}M</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 flex items-center">
              <Activity className="w-3 h-3 mr-1 text-amber-500 animate-pulse" />
              Node system memory
            </span>
          </div>

        </div>

        {/* Cache Storage Metrics card */}
        <div className={`p-5 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-800 dark:border-stone-100">
            <div className="flex items-center space-x-2">
              <Database className="w-4.5 h-4.5 text-cyan-400" />
              <h3 className="text-sm font-semibold">Local Search & Page Cache Storage</h3>
            </div>
            <button 
              onClick={handleClearCache}
              className={`p-1.5 px-3 rounded text-xs font-semibold flex items-center space-x-1 border transition ${
                isDark 
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" 
                  : "bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cache</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-500">Cached Search Queries (TTL: 10 mins)</span>
                <span className="font-mono font-bold text-cyan-500">{cacheStats.searchEntries} query keys</span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-2">
                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${Math.min(100, cacheStats.searchEntries * 10)}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Stores the organic Google/Bing links so duplicate queries load in less than 100ms.</p>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-500">Cached Webpages Content extracts</span>
                <span className="font-mono font-bold text-cyan-500">{cacheStats.pageEntries} document pages</span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-2">
                <div className="bg-cyan-400 h-2 rounded-full" style={{ width: `${Math.min(100, cacheStats.pageEntries * 10)}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">Stores clean body text, tables, headers, and code snippets extracted from visited links.</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Split Columns for Recent Visited Sites & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Recent Visited Unique URLs */}
          <div className={`p-5 rounded-xl border flex flex-col justify-between lg:col-span-1 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <div>
              <div className="flex items-center space-x-2 border-b pb-3 border-slate-800 dark:border-stone-100 mb-3">
                <Layers className="w-4 h-4 text-cyan-500" />
                <h3 className="text-sm font-semibold">Visited Site Streams</h3>
              </div>
              
              {visitedUrls.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center italic">No webpages visited in this session yet.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {visitedUrls.map((url, index) => (
                    <div 
                      key={index}
                      className={`p-2 rounded text-xs font-mono truncate flex items-center justify-between group ${
                        isDark ? "bg-slate-950 hover:bg-slate-800" : "bg-stone-50 hover:bg-stone-100"
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{url}</span>
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="opacity-0 group-hover:opacity-100 text-cyan-500 transition-opacity"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detailed Autonomous Search Logs */}
          <div className={`p-5 rounded-xl border lg:col-span-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-200 shadow-sm"}`}>
            <div className="flex items-center space-x-2 border-b pb-3 border-slate-800 dark:border-stone-100 mb-3">
              <Activity className="w-4 h-4 text-cyan-500 animate-pulse" />
              <h3 className="text-sm font-semibold">Autonomous Research History & Crawl Logs</h3>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center italic">No web research tasks performed yet. Ask Liya a question about current news or web info!</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {history.map((log, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border text-xs space-y-2 ${
                      isDark 
                        ? "bg-slate-950 border-slate-800 hover:border-slate-700" 
                        : "bg-stone-50 border-stone-200 hover:border-stone-300 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-semibold select-all">"{log.query}"</span>
                      </div>
                      <div className="flex items-center space-x-2 font-mono text-[10px] text-slate-500">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">{log.engineUsed}</span>
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-mono">
                      <div>Duration: <span className="font-bold text-cyan-500">{(log.duration / 1000).toFixed(2)}s</span></div>
                      <div>Sources Found: <span className="font-bold text-cyan-500">{log.sourcesCount}</span></div>
                    </div>

                    {log.visitedUrls && log.visitedUrls.length > 0 && (
                      <div className="space-y-1 bg-slate-900/40 p-1.5 rounded border border-slate-800/40">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Top Crawled Links:</span>
                        {log.visitedUrls.map((u, ui) => (
                          <div key={ui} className="font-mono text-[10px] truncate flex items-center space-x-1">
                            <span className="text-cyan-500 select-all truncate">{u}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
