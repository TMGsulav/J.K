import { useState } from "react";
import { Calculator } from "lucide-react";

interface VirtualCalculatorProps {
  theme: "immersive-dark" | "premium-light";
}

export default function VirtualCalculator({ theme }: VirtualCalculatorProps) {
  const [display, setDisplay] = useState<string>("0");
  const [equation, setEquation] = useState<string>("");

  const handleNum = (num: string) => {
    if (display === "0" || display === "Error") {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
    setEquation(equation + num);
  };

  const handleOp = (op: string) => {
    setDisplay("0");
    setEquation(equation + " " + op + " ");
  };

  const handleClear = () => {
    setDisplay("0");
    setEquation("");
  };

  const handleEval = () => {
    try {
      // Safe math evaluation
      const cleanEq = equation.replace(/×/g, "*").replace(/÷/g, "/");
      const result = new Function(`return (${cleanEq})`)();
      if (Number.isNaN(result) || !Number.isFinite(result)) {
        setDisplay("Error");
      } else {
        setDisplay(Number(result.toFixed(6)).toString());
        setEquation(Number(result.toFixed(6)).toString());
      }
    } catch {
      setDisplay("Error");
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl p-4 font-sans max-w-xs mx-auto select-none ${
      theme === "premium-light" ? "bg-stone-50 border border-stone-200 text-stone-800" : "bg-slate-900 border border-slate-800 text-slate-200"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.03] pb-2 mb-3 text-xs font-bold uppercase opacity-80">
        <Calculator className="w-4 h-4 text-emerald-500" />
        <span>Calculator</span>
      </div>

      {/* Screen */}
      <div className="bg-black/35 rounded-xl px-4 py-3 text-right font-mono mb-4 border border-white/[0.03]">
        <div className="text-[10px] text-stone-500 truncate min-h-[14px]">{equation || "0"}</div>
        <div className="text-xl font-bold tracking-tight text-white mt-0.5 truncate">{display}</div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-4 gap-2 text-xs font-mono font-bold">
        <button onClick={handleClear} className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors">C</button>
        <button onClick={() => handleOp("(")} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">(</button>
        <button onClick={() => handleOp(")")} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">)</button>
        <button onClick={() => handleOp("/")} className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors">÷</button>

        <button onClick={() => handleNum("7")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">7</button>
        <button onClick={() => handleNum("8")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">8</button>
        <button onClick={() => handleNum("9")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">9</button>
        <button onClick={() => handleOp("*")} className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors">×</button>

        <button onClick={() => handleNum("4")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">4</button>
        <button onClick={() => handleNum("5")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">5</button>
        <button onClick={() => handleNum("6")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">6</button>
        <button onClick={() => handleOp("-")} className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors">-</button>

        <button onClick={() => handleNum("1")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">1</button>
        <button onClick={() => handleNum("2")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">2</button>
        <button onClick={() => handleNum("3")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">3</button>
        <button onClick={() => handleOp("+")} className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors">+</button>

        <button onClick={() => handleNum("0")} className="col-span-2 p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-all">0</button>
        <button onClick={() => handleNum(".")} className="p-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors">.</button>
        <button onClick={handleEval} className="p-3 bg-emerald-500 text-black hover:bg-emerald-600 rounded-xl transition-colors">=</button>
      </div>
    </div>
  );
}
