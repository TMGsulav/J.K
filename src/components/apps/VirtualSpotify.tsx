import { useState, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack, Music, Volume2, Sparkles } from "lucide-react";

interface Track {
  title: string;
  artist: string;
  duration: string;
}

interface VirtualSpotifyProps {
  onAddLog: (sender: "user" | "liya" | "system", text: string) => void;
}

const tracklist: Track[] = [
  { title: "Liya Synth Beats", artist: "Antigravity", duration: "3:42" },
  { title: "Midnight Coding", artist: "Hacker Ambient", duration: "4:05" },
  { title: "Rainy Afternoon in Paris", artist: "Lo-Fi Collective", duration: "2:58" },
  { title: "Deep Focus Alpha Waves", artist: "Neural Wave", duration: "5:20" }
];

export default function VirtualSpotify({ onAddLog }: VirtualSpotifyProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const activeTrack = tracklist[currentTrackIndex];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            handleNext();
            return 0;
          }
          return p + 1.2;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackIndex]);

  const handlePlayPause = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    onAddLog("system", nextState ? `Started playing ${activeTrack.title}` : `Paused ${activeTrack.title}`);
  };

  const handleNext = () => {
    setCurrentTrackIndex(prev => (prev + 1) % tracklist.length);
    setProgress(0);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentTrackIndex(prev => (prev - 1 + tracklist.length) % tracklist.length);
    setProgress(0);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-black text-slate-100 font-sans select-none overflow-hidden border border-white/[0.04]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-extrabold text-sm">S</div>
          <span className="font-bold tracking-tight text-white text-sm">Spotify</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1db954]/10 border border-[#1db954]/20 text-[#1db954] text-[10px] font-mono tracking-wider font-bold">
          <Sparkles className="w-3 h-3 animate-pulse" />
          <span>LIYA MIX ONLINE</span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col md:flex-row gap-5 overflow-y-auto">
        {/* Album Art & Controls */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-36 h-36 rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-800 flex flex-col items-center justify-center border border-white/10 shadow-xl relative overflow-hidden group">
            <Music className="w-12 h-12 text-white/40 group-hover:scale-105 transition-transform" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-8 h-8 text-emerald-400 fill-emerald-400" />
            </div>
            {/* Visualizer bars on art if playing */}
            {isPlaying && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1 px-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full"
                    style={{
                      height: `${10 + Math.random() * 25}px`,
                      animation: `bounce ${0.4 + i * 0.1}s ease-in-out infinite alternate`
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-white leading-tight truncate max-w-[200px]">{activeTrack.title}</h3>
            <p className="text-[11px] text-stone-400 mt-0.5">{activeTrack.artist}</p>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-[200px] space-y-1.5">
            <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-stone-500 font-mono font-medium">
              <span>0:{Math.floor((progress / 100) * 60) < 10 ? "0" : ""}{Math.floor((progress / 100) * 60)}</span>
              <span>{activeTrack.duration}</span>
            </div>
          </div>

          {/* Player controls */}
          <div className="flex items-center space-x-5">
            <button onClick={handlePrev} className="p-1.5 hover:bg-stone-900 rounded-full hover:text-white text-stone-400 transition-colors">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={handlePlayPause} className="p-3 bg-white text-black hover:scale-105 transition-all rounded-full flex items-center justify-center">
              {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
            </button>
            <button onClick={handleNext} className="p-1.5 hover:bg-stone-900 rounded-full hover:text-white text-stone-400 transition-colors">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Playlist selection column */}
        <div className="w-full md:w-44 flex flex-col space-y-3 shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Tracklist</p>
          <div className="space-y-1 overflow-y-auto flex-1">
            {tracklist.map((track, idx) => {
              const isActive = idx === currentTrackIndex;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentTrackIndex(idx);
                    setProgress(0);
                    setIsPlaying(true);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors font-medium border border-transparent ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "hover:bg-white/[0.02] text-slate-400"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold truncate leading-snug">{track.title}</p>
                    <p className="text-[9px] text-stone-500 truncate leading-snug">{track.artist}</p>
                  </div>
                  <span className="text-[9px] font-mono opacity-60 ml-2">{track.duration}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-stone-500 border-t border-white/5 pt-2 select-none">
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Volume 80%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
