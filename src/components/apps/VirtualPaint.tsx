import React, { useRef, useState, useEffect } from "react";
import { Palette, Trash } from "lucide-react";

interface VirtualPaintProps {
  theme: "immersive-dark" | "premium-light";
}

const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#f43f5e", "#ffffff", "#000000"];

export default function VirtualPaint({ theme }: VirtualPaintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [color, setColor] = useState<string>("#3b82f6");
  const [brushSize, setBrushSize] = useState<number>(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
      }
    }
  }, [color, brushSize]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl p-4 font-sans select-none overflow-hidden ${
      theme === "premium-light" ? "bg-stone-50 border border-stone-200 text-stone-800" : "bg-slate-900 border border-slate-800 text-slate-200"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.03] pb-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase opacity-80">
          <Palette className="w-4 h-4 text-pink-500" />
          <span>Canvas Paint</span>
        </div>
        <button
          onClick={clearCanvas}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-lg font-mono font-bold uppercase transition-colors"
        >
          <Trash className="w-3 h-3" />
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 rounded-xl overflow-hidden bg-white border border-white/[0.04] relative">
        <canvas
          ref={canvasRef}
          width={360}
          height={260}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-full cursor-crosshair"
        />
      </div>

      {/* Tools / Palette */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Colors */}
        <div className="flex gap-1.5 flex-wrap">
          {colors.map((c, i) => (
            <button
              key={i}
              onClick={() => setColor(c)}
              className="w-5 h-5 rounded-full border border-black/20 focus:scale-110 active:scale-95 transition-all"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 2px ${theme === "premium-light" ? "#2563eb" : "#38bdf8"}` : "none"
              }}
            />
          ))}
        </div>

        {/* Brush Size Slider */}
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
          <span>SIZE:</span>
          <input
            type="range"
            min={1}
            max={12}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 accent-pink-500 h-1 bg-stone-700 rounded-full appearance-none outline-none cursor-pointer"
          />
          <span className="w-4 text-right">{brushSize}px</span>
        </div>
      </div>
    </div>
  );
}
