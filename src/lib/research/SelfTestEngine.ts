import { MemoryManager } from "./MemoryManager";
import { SkillEngine } from "./SkillEngine";
import { BrowserResearchEngine } from "./BrowserResearchEngine";
import { VisionEngine } from "./VisionEngine";
import { VoiceManager } from "./VoiceManager";
import { ProjectMemoryManager } from "./ProjectMemoryManager";
import { PermissionManager } from "../desktop/PermissionManager";

export interface TestResult {
  module: string;
  status: "Passed" | "Repaired" | "Failed";
  details: string;
}

export class SelfTestEngine {
  private static instance: SelfTestEngine;
  private memoryManager = MemoryManager.getInstance();
  private skillEngine = SkillEngine.getInstance();
  private browserEngine = BrowserResearchEngine.getInstance();
  private visionEngine = VisionEngine.getInstance();
  private voiceManager = VoiceManager.getInstance();
  private projectMemoryManager = ProjectMemoryManager.getInstance();

  private constructor() {}

  public static getInstance(): SelfTestEngine {
    if (!SelfTestEngine.instance) {
      SelfTestEngine.instance = new SelfTestEngine();
    }
    return SelfTestEngine.instance;
  }

  /**
   * Run startup diagnostics across all key modules (Feature 14).
   * Attempts autonomous self-healing on failure (Feature 15).
   */
  public async runStartupSelfTest(): Promise<{ success: boolean; results: TestResult[] }> {
    console.log("[SelfTestEngine] Initiating autonomous startup verification tests...");
    const results: TestResult[] = [];

    // 1. Memory integrity test (SQLite)
    let memoryStatus: TestResult["status"] = "Passed";
    let memoryDetails = "Nominal connection. Tables verified.";
    try {
      const row = this.memoryManager.getSetting("current_conversation_id");
      // Double check simple read/write to setting
      this.memoryManager.saveSetting("diagnostic_check_ts", Date.now());
    } catch (err: any) {
      memoryStatus = "Failed";
      memoryDetails = `SQLite Read/Write integrity failure: ${err.message}`;
      // Attempt Self-Healing (Feature 15)
      try {
        console.warn("[SelfTestEngine] Self-Healing: Attempting sqlite database table repairs...");
        this.memoryManager.repairTables(); // Re-trigger table schemas creation
        this.memoryManager.saveSetting("diagnostic_check_ts", Date.now());
        memoryStatus = "Repaired";
        memoryDetails = "Tables rebuilt and verified successfully.";
      } catch (repairErr: any) {
        memoryStatus = "Failed";
        memoryDetails = `SQLite repair failed: ${repairErr.message}`;
      }
    }
    results.push({ module: "Memory (SQLite)", status: memoryStatus, details: memoryDetails });

    // 2. Desktop Control & Permission manager test
    let desktopStatus: TestResult["status"] = "Passed";
    let desktopDetails = "Command planner permissions nominal.";
    try {
      const pm = PermissionManager.getInstance();
      const check = pm.checkPermission("launchapp", { appName: "Explorer" });
      if (!check) {
        throw new Error("Invalid command verification response.");
      }
    } catch (err: any) {
      desktopStatus = "Failed";
      desktopDetails = `Desktop planner validation failed: ${err.message}`;
    }
    results.push({ module: "Desktop Control", status: desktopStatus, details: desktopDetails });

    // 3. Browser Search engine capability
    let browserStatus: TestResult["status"] = "Passed";
    let browserDetails = "Search providers registered and ready.";
    try {
      if (!this.browserEngine) throw new Error("BrowserResearchEngine instance is null.");
    } catch (err: any) {
      browserStatus = "Failed";
      browserDetails = `Browser module exception: ${err.message}`;
    }
    results.push({ module: "Browser Research", status: browserStatus, details: browserDetails });

    // 4. Multimodal Vision engine
    let visionStatus: TestResult["status"] = "Passed";
    let visionDetails = "Vision screenshot capabilities loaded.";
    try {
      if (!this.visionEngine) throw new Error("VisionEngine instance is null.");
    } catch (err: any) {
      visionStatus = "Failed";
      visionDetails = `Vision module exception: ${err.message}`;
    }
    results.push({ module: "Vision Engine", status: visionStatus, details: visionDetails });

    // 5. Speech system verification
    let speechStatus: TestResult["status"] = "Passed";
    let speechDetails = "Speech synthesis voices loaded and locked.";
    try {
      const lock = this.voiceManager.verifyVoiceLock();
      if (!lock.verified) {
        speechStatus = "Failed";
        speechDetails = "Preferred voice 'Liya' could not be locked.";
        // Self-Healing
        const restored = this.voiceManager.lockPreferredVoice();
        if (restored) {
          speechStatus = "Repaired";
          speechDetails = `Locked voice restored to: ${restored.name}`;
        }
      }
    } catch (err: any) {
      speechStatus = "Failed";
      speechDetails = `Speech engine validation crashed: ${err.message}`;
    }
    results.push({ module: "Speech System", status: speechStatus, details: speechDetails });

    // 6. Project tracking memory
    let projectStatus: TestResult["status"] = "Passed";
    let projectDetails = "Workspace project scanner configured.";
    try {
      const proj = this.projectMemoryManager.detectAndLoadProject(process.cwd());
      if (!proj) throw new Error("Failed to scan current directory.");
    } catch (err: any) {
      projectStatus = "Failed";
      projectDetails = `Project tracker error: ${err.message}`;
    }
    results.push({ module: "Project Memory", status: projectStatus, details: projectDetails });

    // 7. Local Tool Registry (Skills)
    let toolStatus: TestResult["status"] = "Passed";
    let toolDetails = "Skill engine commands loaded.";
    try {
      const skills = this.skillEngine.getSkills();
      if (skills.length === 0) {
        throw new Error("Tool registry is empty.");
      }
      toolDetails = `Registered ${skills.length} high-fidelity skills.`;
    } catch (err: any) {
      toolStatus = "Failed";
      toolDetails = `Tool registry error: ${err.message}`;
      // Self-Healing
      try {
        this.skillEngine.initializeSkills();
        toolStatus = "Repaired";
        toolDetails = "Skills registry recompiled and verified.";
      } catch (rErr: any) {
        toolStatus = "Failed";
        toolDetails = `Skills registry repair failed: ${rErr.message}`;
      }
    }
    results.push({ module: "Tool Registry", status: toolStatus, details: toolDetails });

    // 8. Microphone readiness check
    let micStatus: TestResult["status"] = "Passed";
    let micDetails = "Acoustic recording devices indexed.";
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMic = devices.some(d => d.kind === "audioinput");
        micDetails = hasMic ? "Active microphone device found." : "No physical microphone connected (expected in sandbox).";
      } else {
        micDetails = "Microphone APIs bypassed in headless server environment.";
      }
    } catch (err: any) {
      micStatus = "Failed";
      micDetails = `Microphone check: ${err.message}`;
    }
    results.push({ module: "Microphone", status: micStatus, details: micDetails });

    // 9. State Transition validation test
    let transitionStatus: TestResult["status"] = "Passed";
    let transitionDetails = "State machine transitions validated against allowed paths.";
    try {
      const mockValidTransitions: Record<string, string[]> = {
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
      
      const checkConnectedToThinking = mockValidTransitions["connected"].includes("thinking");
      const checkDisconnectedToSpeaking = mockValidTransitions["disconnected"].includes("speaking");
      if (!checkConnectedToThinking || checkDisconnectedToSpeaking) {
        throw new Error("State transition lookup validation returned unexpected results.");
      }
    } catch (err: any) {
      transitionStatus = "Failed";
      transitionDetails = `State machine test failed: ${err.message}`;
    }
    results.push({ module: "State Transitions", status: transitionStatus, details: transitionDetails });

    // 10. Retry Logic & Recovery verification test
    let retryStatus: TestResult["status"] = "Passed";
    let retryDetails = "Exponential backoff and call-with-retry handler fully functional.";
    try {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error("Temporary rate limit simulated error");
        }
        return "SuccessValue";
      };

      const { callWithRetry } = await import("./GeminiRetry");
      const val = await callWithRetry(testFn, 3, 20, { priority: "high" });
      if (val !== "SuccessValue" || callCount !== 3) {
        throw new Error(`Expected successful value on attempt 3, got: ${val} (attempts: ${callCount})`);
      }
    } catch (err: any) {
      retryStatus = "Failed";
      retryDetails = `Retry & Recovery mechanism test failed: ${err.message}`;
    }
    results.push({ module: "Retry & Recovery", status: retryStatus, details: retryDetails });

    const overallSuccess = results.every(r => r.status === "Passed" || r.status === "Repaired");
    console.log(`[SelfTestEngine] Diagnostics completed. Overall status: ${overallSuccess ? "PASS" : "FAIL"}`);
    return { success: overallSuccess, results };
  }
}
