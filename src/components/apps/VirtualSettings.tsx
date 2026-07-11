import { useState } from "react";
import { Settings, ShieldAlert, Volume2, Sparkles, Trash, Save, Plus, X, User, Brain, Database, ListCollapse, Clock, FileCode } from "lucide-react";

interface VirtualSettingsProps {
  theme: "immersive-dark" | "premium-light";
  onChangeTheme: (theme: "immersive-dark" | "premium-light") => void;
  liyaMemory: any;
  onClearMemory: () => void;
}

type MemoryTab = "profile" | "longTerm" | "knowledge" | "episodic" | "semantic" | "summaries";

export default function VirtualSettings({ theme, onChangeTheme, liyaMemory, onClearMemory }: VirtualSettingsProps) {
  const [vol, setVol] = useState<number>(80);
  const [activeTab, setActiveTab] = useState<MemoryTab>("profile");
  
  // Local edit states for User Profile
  const [profileName, setProfileName] = useState<string>(liyaMemory?.userProfile?.name || "");
  const [profileNickname, setProfileNickname] = useState<string>(liyaMemory?.userProfile?.nickname || "");
  const [profileLevel, setProfileLevel] = useState<string>(liyaMemory?.userProfile?.knowledgeLevel || "Intermediate");

  // Local edit states for Long Term Memory inputs
  const [preferredCodingStyle, setPreferredCodingStyle] = useState<string>(liyaMemory?.longTermMemory?.preferredCodingStyle || "");
  const [newLang, setNewLang] = useState<string>("");
  const [newProject, setNewProject] = useState<string>("");
  const [newInterest, setNewInterest] = useState<string>("");
  const [newObjective, setNewObjective] = useState<string>("");

  // Local edit states for Knowledge Base inputs
  const [newFactKey, setNewFactKey] = useState<string>("");
  const [newFactVal, setNewFactVal] = useState<string>("");

  const [savingState, setSavingState] = useState<string | null>(null);

  // Sync edit values with liyaMemory whenever it updates externally
  useState(() => {
    if (liyaMemory) {
      setProfileName(liyaMemory.userProfile?.name || "");
      setProfileNickname(liyaMemory.userProfile?.nickname || "");
      setProfileLevel(liyaMemory.userProfile?.knowledgeLevel || "Intermediate");
      setPreferredCodingStyle(liyaMemory.longTermMemory?.preferredCodingStyle || "");
    }
  });

  const handleWipeMemory = () => {
    if (confirm("⚠️ SECURITY VERIFICATION SYSTEM:\n\nAre you sure you want to completely erase Liya's consolidated brain memories?\nThis will clear all long-term personalization facts, style guidelines, and historical summaries. This cannot be undone.")) {
      onClearMemory();
    }
  };

  // Generic fetch wrapper to POST memory updates back to the backend
  const postMemoryUpdate = async (type: string, payload: any, sectionLabel: string) => {
    setSavingState(sectionLabel);
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryType: type, updatePayload: payload }),
      });
      if (response.ok) {
        // Dispatch the custom event to notify useLiya to re-fetch
        window.dispatchEvent(new CustomEvent("liya-memory-updated"));
        setTimeout(() => setSavingState(null), 800);
      } else {
        throw new Error("Failed to persist");
      }
    } catch (e) {
      console.error("Memory saving failed:", e);
      alert("⚠️ Error saving memory values. Please check your system endpoints.");
      setSavingState(null);
    }
  };

  const handleSaveProfile = () => {
    postMemoryUpdate("userProfile", {
      name: profileName,
      nickname: profileNickname,
      knowledgeLevel: profileLevel
    }, "profile");
  };

  const handleSaveCodingStyle = () => {
    postMemoryUpdate("longTermMemory", {
      preferredCodingStyle: preferredCodingStyle
    }, "codingStyle");
  };

  const handleAddTag = (field: string, newValue: string, setter: (val: string) => void) => {
    if (!newValue.trim()) return;
    const currentList = liyaMemory?.longTermMemory?.[field] || [];
    if (!currentList.includes(newValue.trim())) {
      const updatedList = [...currentList, newValue.trim()];
      postMemoryUpdate("longTermMemory", { [field]: updatedList }, field);
      setter("");
    }
  };

  const handleRemoveTag = (field: string, itemToRemove: string) => {
    const currentList = liyaMemory?.longTermMemory?.[field] || [];
    const updatedList = currentList.filter((item: string) => item !== itemToRemove);
    postMemoryUpdate("longTermMemory", { [field]: updatedList }, field);
  };

  const handleAddFact = () => {
    if (!newFactKey.trim() || !newFactVal.trim()) return;
    const currentKnowledge = liyaMemory?.knowledgeMemory || {};
    const updatedKnowledge = { ...currentKnowledge, [newFactKey.trim()]: newFactVal.trim() };
    postMemoryUpdate("knowledgeMemory", updatedKnowledge, "knowledge");
    setNewFactKey("");
    setNewFactVal("");
  };

  const handleRemoveFact = (keyToRemove: string) => {
    const currentKnowledge = liyaMemory?.knowledgeMemory || {};
    const { [keyToRemove]: _, ...updatedKnowledge } = currentKnowledge;
    postMemoryUpdate("knowledgeMemory", updatedKnowledge, "knowledge-remove");
  };

  const isDark = theme === "immersive-dark";

  return (
    <div className={`flex flex-col h-full rounded-2xl p-4 font-sans select-none overflow-hidden ${
      isDark ? "bg-slate-900 border border-slate-800 text-slate-200" : "bg-stone-50 border border-stone-200 text-stone-800"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.03] pb-2 mb-3 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase opacity-80">
          <Settings className="w-4 h-4 text-blue-500" />
          <span>Liya OS Settings &amp; Memory</span>
        </div>
        <span className="font-mono text-[9px] tracking-widest text-stone-500">LIYA CORE BRAIN INTERFACE</span>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Side: Parameters Panel */}
        <div className="w-52 flex flex-col gap-4 border-r border-white/[0.03] pr-4 shrink-0 overflow-y-auto">
          {/* Audio Volume */}
          <div className="space-y-1.5">
            <p className="font-bold uppercase tracking-wider text-stone-500 text-[10px]">Audio volume</p>
            <div className={`flex items-center gap-2 p-2.5 rounded-xl border font-medium ${isDark ? "bg-white/5 border-white/[0.03]" : "bg-stone-100 border-stone-200"}`}>
              <Volume2 className="w-4 h-4 text-blue-500 shrink-0" />
              <input
                type="range"
                min={0}
                max={100}
                value={vol}
                onChange={(e) => setVol(Number(e.target.value))}
                className="w-full h-1 bg-stone-700 accent-blue-500 rounded-full appearance-none cursor-pointer"
              />
              <span className="font-mono font-bold text-[9px]">{vol}%</span>
            </div>
          </div>

          {/* Workspace Theme */}
          <div className="space-y-1.5">
            <p className="font-bold uppercase tracking-wider text-stone-500 text-[10px]">Visual Theme skin</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => onChangeTheme("immersive-dark")}
                className={`w-full p-2 rounded-xl border text-left text-[11px] font-bold transition-all ${
                  isDark
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-md"
                    : "bg-stone-100/30 border-stone-200 hover:bg-stone-200"
                }`}
              >
                🌌 Immersive Dark
              </button>
              <button
                onClick={() => onChangeTheme("premium-light")}
                className={`w-full p-2 rounded-xl border text-left text-[11px] font-bold transition-all ${
                  !isDark
                    ? "bg-blue-600 text-white border-blue-600 shadow-md"
                    : "bg-white/[0.02] border-white/[0.03] hover:bg-white/[0.04]"
                }`}
              >
                🏛️ Premium Light
              </button>
            </div>
          </div>

          {/* Wipe memory panel */}
          <div className="space-y-1.5 mt-auto">
            <p className="font-bold uppercase tracking-wider text-stone-500 text-[10px]">Memory System Wipe</p>
            <div className="p-2.5 bg-red-500/[0.02] border border-red-500/10 rounded-xl space-y-2">
              <p className="text-[10px] text-stone-400 leading-relaxed">
                Clearing consolidated memory resets Liya's behavior back to defaults.
              </p>
              <button
                onClick={handleWipeMemory}
                className="w-full flex items-center justify-center gap-1.5 p-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors uppercase font-mono tracking-wider text-[9px]"
              >
                <Trash className="w-3.5 h-3.5" />
                Wipe Brain Memory
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Brain Memory Explorer */}
        <div className="flex-1 flex flex-col min-h-0">
          <p className="font-bold uppercase tracking-wider text-stone-500 text-[10px] mb-2 shrink-0">Consolidated Memory Explorer</p>
          
          {/* Navigation Tab strip */}
          <div className="flex gap-1 border-b border-white/[0.03] pb-2 shrink-0 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "profile"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "hover:bg-white/5 text-stone-400"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              UserProfile
            </button>
            <button
              onClick={() => setActiveTab("longTerm")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "longTerm"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "hover:bg-white/5 text-stone-400"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              LongTerm
            </button>
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "knowledge"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "hover:bg-white/5 text-stone-400"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Knowledge
            </button>
            <button
              onClick={() => setActiveTab("episodic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "episodic"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "hover:bg-white/5 text-stone-400"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Episodes
            </button>
            <button
              onClick={() => setActiveTab("semantic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "semantic"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "hover:bg-white/5 text-stone-400"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Semantic
            </button>
            <button
              onClick={() => setActiveTab("summaries")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTab === "summaries"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "hover:bg-white/5 text-stone-400"
              }`}
            >
              <ListCollapse className="w-3.5 h-3.5" />
              Summaries
            </button>
          </div>

          {/* Active Tab view content */}
          <div className="flex-1 overflow-y-auto pt-3.5 space-y-4 pr-1 text-xs">
            {activeTab === "profile" && (
              <div className="space-y-4.5">
                <div className="space-y-3.5 p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> User Profile parameters
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase">First Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className={`w-full p-2 rounded-xl text-xs font-semibold border ${
                          isDark ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500/50" : "bg-white border-stone-200 text-stone-800 focus:border-blue-500/50"
                        } outline-none transition-all`}
                        placeholder="e.g. Sulav"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase">Nickname / Pronoun</label>
                      <input
                        type="text"
                        value={profileNickname}
                        onChange={(e) => setProfileNickname(e.target.value)}
                        className={`w-full p-2 rounded-xl text-xs font-semibold border ${
                          isDark ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500/50" : "bg-white border-stone-200 text-stone-800 focus:border-blue-500/50"
                        } outline-none transition-all`}
                        placeholder="e.g. Master Coder"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase">Coding Skill Level</label>
                    <select
                      value={profileLevel}
                      onChange={(e) => setProfileLevel(e.target.value)}
                      className={`w-full p-2 rounded-xl text-xs font-semibold border ${
                        isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-stone-200 text-stone-800"
                      } outline-none`}
                    >
                      <option value="Beginner">Beginner - Prefers simple, highly explained code snippets</option>
                      <option value="Intermediate">Intermediate - Prefers standard idiomatic structures</option>
                      <option value="Advanced">Advanced - Prefers performant, concurrent, design-pattern layouts</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {savingState === "profile" ? "Saving..." : "Save Profile Details"}
                  </button>
                </div>
                
                <p className="text-[11px] text-stone-500 leading-relaxed italic">
                  Note: Liya listens to your conversation and automatically updates these variables in the background, or you can adjust them here.
                </p>
              </div>
            )}

            {activeTab === "longTerm" && (
              <div className="space-y-4">
                {/* Coding Style */}
                <div className="p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl space-y-3">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" /> Preferred Coding Style Guidelines
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={preferredCodingStyle}
                      onChange={(e) => setPreferredCodingStyle(e.target.value)}
                      className={`flex-1 p-2 rounded-xl text-xs border ${
                        isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-stone-200 text-stone-800"
                      } outline-none`}
                      placeholder="e.g. functional components, TypeScript, Tailwind, descriptive naming"
                    />
                    <button
                      onClick={handleSaveCodingStyle}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>

                {/* Arrays of long term lists: Favorite Languages, Projects, Interests */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Languages */}
                  <div className="p-3.5 bg-white/[0.01] border border-white/[0.02] rounded-2xl space-y-2.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400">Favorite Languages</span>
                    
                    <div className="flex flex-wrap gap-1.5 min-h-[44px]">
                      {(liyaMemory?.longTermMemory?.favoriteLanguages || []).map((lang: string) => (
                        <span key={lang} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-[9px] font-bold">
                          {lang}
                          <button onClick={() => handleRemoveTag("favoriteLanguages", lang)} className="hover:text-red-400">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {(liyaMemory?.longTermMemory?.favoriteLanguages || []).length === 0 && (
                        <span className="text-stone-500 italic text-[11px] py-1">No languages saved.</span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1 border-t border-white/[0.02]">
                      <input
                        type="text"
                        value={newLang}
                        onChange={(e) => setNewLang(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag("favoriteLanguages", newLang, setNewLang)}
                        className={`flex-1 p-1.5 rounded-lg text-[11px] border ${
                          isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-stone-200 text-stone-800"
                        } outline-none`}
                        placeholder="Add language..."
                      />
                      <button onClick={() => handleAddTag("favoriteLanguages", newLang, setNewLang)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="p-3.5 bg-white/[0.01] border border-white/[0.02] rounded-2xl space-y-2.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400">Current Projects</span>
                    
                    <div className="flex flex-wrap gap-1.5 min-h-[44px]">
                      {(liyaMemory?.longTermMemory?.currentProjects || []).map((proj: string) => (
                        <span key={proj} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[9px] font-bold">
                          {proj}
                          <button onClick={() => handleRemoveTag("currentProjects", proj)} className="hover:text-red-400">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {(liyaMemory?.longTermMemory?.currentProjects || []).length === 0 && (
                        <span className="text-stone-500 italic text-[11px] py-1">No projects saved.</span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1 border-t border-white/[0.02]">
                      <input
                        type="text"
                        value={newProject}
                        onChange={(e) => setNewProject(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag("currentProjects", newProject, setNewProject)}
                        className={`flex-1 p-1.5 rounded-lg text-[11px] border ${
                          isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-stone-200 text-stone-800"
                        } outline-none`}
                        placeholder="Add project..."
                      />
                      <button onClick={() => handleAddTag("currentProjects", newProject, setNewProject)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Hobbies / Interests */}
                  <div className="p-3.5 bg-white/[0.01] border border-white/[0.02] rounded-2xl space-y-2.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400">Interests &amp; Hobbies</span>
                    
                    <div className="flex flex-wrap gap-1.5 min-h-[44px]">
                      {(liyaMemory?.longTermMemory?.interests || []).map((interest: string) => (
                        <span key={interest} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[9px] font-bold">
                          {interest}
                          <button onClick={() => handleRemoveTag("interests", interest)} className="hover:text-red-400">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {(liyaMemory?.longTermMemory?.interests || []).length === 0 && (
                        <span className="text-stone-500 italic text-[11px] py-1">No interests saved.</span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1 border-t border-white/[0.02]">
                      <input
                        type="text"
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag("interests", newInterest, setNewInterest)}
                        className={`flex-1 p-1.5 rounded-lg text-[11px] border ${
                          isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-stone-200 text-stone-800"
                        } outline-none`}
                        placeholder="Add interest..."
                      />
                      <button onClick={() => handleAddTag("interests", newInterest, setNewInterest)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Objectives */}
                  <div className="p-3.5 bg-white/[0.01] border border-white/[0.02] rounded-2xl space-y-2.5">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-400">Objectives &amp; Milestones</span>
                    
                    <div className="flex flex-wrap gap-1.5 min-h-[44px]">
                      {(liyaMemory?.longTermMemory?.objectives || []).map((obj: string) => (
                        <span key={obj} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[9px] font-bold">
                          {obj}
                          <button onClick={() => handleRemoveTag("objectives", obj)} className="hover:text-red-400">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {(liyaMemory?.longTermMemory?.objectives || []).length === 0 && (
                        <span className="text-stone-500 italic text-[11px] py-1">No objectives set.</span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1 border-t border-white/[0.02]">
                      <input
                        type="text"
                        value={newObjective}
                        onChange={(e) => setNewObjective(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag("objectives", newObjective, setNewObjective)}
                        className={`flex-1 p-1.5 rounded-lg text-[11px] border ${
                          isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-stone-200 text-stone-800"
                        } outline-none`}
                        placeholder="Add objective..."
                      />
                      <button onClick={() => handleAddTag("objectives", newObjective, setNewObjective)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "knowledge" && (
              <div className="space-y-4">
                <div className="p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl space-y-3.5">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Taught Facts &amp; Knowledge Rules
                  </h4>
                  
                  {/* List of custom facts */}
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {Object.entries(liyaMemory?.knowledgeMemory || {}).map(([key, val]: [string, any]) => (
                      <div key={key} className={`flex items-start justify-between p-2 rounded-xl border font-mono text-[10px] ${
                        isDark ? "bg-slate-950 border-slate-800/80" : "bg-white border-stone-200"
                      }`}>
                        <div className="flex-1 text-left">
                          <span className="text-blue-400 font-bold">{key}: </span>
                          <span className="text-stone-300">{val}</span>
                        </div>
                        <button onClick={() => handleRemoveFact(key)} className="text-slate-500 hover:text-red-400 ml-2">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {Object.keys(liyaMemory?.knowledgeMemory || {}).length === 0 && (
                      <p className="text-stone-500 italic text-center py-4">No facts stored in the knowledge base. Try teaching her something!</p>
                    )}
                  </div>

                  {/* Form to teach fact */}
                  <div className={`p-3 rounded-2xl border space-y-2.5 ${isDark ? "bg-slate-950 border-slate-800" : "bg-stone-50 border-stone-200"}`}>
                    <p className="font-bold text-[9px] uppercase tracking-wider text-stone-400">Add custom fact manually</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newFactKey}
                        onChange={(e) => setNewFactKey(e.target.value)}
                        className={`p-1.5 rounded-lg text-[11px] border outline-none ${
                          isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-stone-200 text-stone-800"
                        }`}
                        placeholder="Key (e.g. favorite drink)"
                      />
                      <input
                        type="text"
                        value={newFactVal}
                        onChange={(e) => setNewFactVal(e.target.value)}
                        className={`p-1.5 rounded-lg text-[11px] border outline-none ${
                          isDark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-stone-200 text-stone-800"
                        }`}
                        placeholder="Value (e.g. Iced Match Latte)"
                      />
                    </div>
                    <button
                      onClick={handleAddFact}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] tracking-wider uppercase"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Teach Fact
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "episodic" && (
              <div className="space-y-3">
                <div className="p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5" /> Episodic Memory Stream
                  </h4>
                  
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {(liyaMemory?.episodicMemory || []).map((episode: any, idx: number) => (
                      <div key={idx} className={`p-2.5 rounded-xl border text-left flex items-start space-x-2.5 ${
                        isDark ? "bg-slate-950 border-slate-800/80" : "bg-white border-stone-200"
                      }`}>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-blue-500/10 text-blue-400 font-bold shrink-0 mt-0.5">
                          {episode.date || "Moment"}
                        </span>
                        <p className="text-[11px] leading-relaxed font-sans">{episode.event}</p>
                      </div>
                    ))}
                    {(liyaMemory?.episodicMemory || []).length === 0 && (
                      <p className="text-stone-500 italic text-center py-6">No episodic events captured yet. Episodes are consolidated after closing sessions.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "semantic" && (
              <div className="space-y-4">
                <div className="p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl space-y-3.5">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Semantic User Profiles
                  </h4>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Strengths */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-[10px] uppercase text-stone-400 tracking-wider">Strengths</span>
                      <div className={`p-2 rounded-xl min-h-[100px] border ${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-stone-200"}`}>
                        {(liyaMemory?.semanticMemory?.strengths || []).map((s: string, idx: number) => (
                          <div key={idx} className="p-1 text-[10px] text-left text-emerald-400 font-mono">• {s}</div>
                        ))}
                        {(liyaMemory?.semanticMemory?.strengths || []).length === 0 && (
                          <p className="text-stone-500 italic text-[9px] py-4 text-center">None discovered.</p>
                        )}
                      </div>
                    </div>

                    {/* Weaknesses */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-[10px] uppercase text-stone-400 tracking-wider">Weaknesses</span>
                      <div className={`p-2 rounded-xl min-h-[100px] border ${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-stone-200"}`}>
                        {(liyaMemory?.semanticMemory?.weaknesses || []).map((w: string, idx: number) => (
                          <div key={idx} className="p-1 text-[10px] text-left text-rose-400 font-mono">• {w}</div>
                        ))}
                        {(liyaMemory?.semanticMemory?.weaknesses || []).length === 0 && (
                          <p className="text-stone-500 italic text-[9px] py-4 text-center">None discovered.</p>
                        )}
                      </div>
                    </div>

                    {/* Habits */}
                    <div className="space-y-1.5">
                      <span className="font-bold text-[10px] uppercase text-stone-400 tracking-wider">Habits</span>
                      <div className={`p-2 rounded-xl min-h-[100px] border ${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-stone-200"}`}>
                        {(liyaMemory?.semanticMemory?.habits || []).map((h: string, idx: number) => (
                          <div key={idx} className="p-1 text-[10px] text-left text-cyan-400 font-mono">• {h}</div>
                        ))}
                        {(liyaMemory?.semanticMemory?.habits || []).length === 0 && (
                          <p className="text-stone-500 italic text-[9px] py-4 text-center">None discovered.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "summaries" && (
              <div className="space-y-3">
                <div className="p-4 bg-white/[0.02] border border-white/[0.02] rounded-2xl">
                  <h4 className="font-bold text-[11px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5 mb-3">
                    <ListCollapse className="w-3.5 h-3.5" /> Recent Sessions Summaries
                  </h4>
                  
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {(liyaMemory?.recentSessionsSummary || []).map((summary: string, idx: number) => (
                      <div key={idx} className={`p-2.5 rounded-xl border text-left ${
                        isDark ? "bg-slate-950 border-slate-800/80" : "bg-white border-stone-200"
                      }`}>
                        <p className="text-[11px] leading-relaxed font-sans">{summary}</p>
                      </div>
                    ))}
                    {(liyaMemory?.recentSessionsSummary || []).length === 0 && (
                      <p className="text-stone-500 italic text-center py-6">No session summaries available yet. Session dialogue outlines are summarized automatically.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
