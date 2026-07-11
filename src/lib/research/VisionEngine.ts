import { GoogleGenAI } from "@google/genai";
import { MemoryManager } from "./MemoryManager";
import { VisionManager } from "./VisionManager";

export interface VisionAnalysisResult {
  success: boolean;
  analysis: string;
  observedWindows: string[];
  timestamp: number;
}

export class VisionEngine {
  private static instance: VisionEngine;

  private constructor() {}

  public static getInstance(): VisionEngine {
    if (!VisionEngine.instance) {
      VisionEngine.instance = new VisionEngine();
    }
    return VisionEngine.instance;
  }

  /**
   * Captures the screen on explicit user request, converts it to base64, and analyzes it.
   * Delegates to VisionManager to leverage live screen awareness.
   */
  public async captureAndAnalyzeScreen(
    query: string = "Analyze the screenshot and summarize the active windows/content.",
    getGoogleGenAI: () => any
  ): Promise<VisionAnalysisResult> {
    console.log(`[VisionEngine] Delegating on-demand capture and analysis to VisionManager.`);
    try {
      const visionManager = VisionManager.getInstance();
      const analysisText = await visionManager.captureAndAnalyzeScreen(query, getGoogleGenAI);

      const observedWindows: string[] = [];
      const commonApps = ["vscode", "chrome", "terminal", "notepad", "calculator", "browser", "spotify", "explorer", "github"];
      for (const app of commonApps) {
        if (analysisText.toLowerCase().includes(app)) {
          observedWindows.push(app);
        }
      }

      return {
        success: true,
        analysis: analysisText,
        observedWindows,
        timestamp: Date.now()
      };
    } catch (err: any) {
      console.error("[VisionEngine] Capture and analysis delegation failed:", err);
      return {
        success: false,
        analysis: `Failed to analyze screen: ${err.message}`,
        observedWindows: [],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Analyzes a screenshot base64 image or active window view.
   * Feeds the image into the VisionManager frame buffer, then triggers analysis.
   */
  public async analyzeScreen(
    base64Image: string,
    query: string = "Analyze the screenshot and summarize the active windows/content.",
    getGoogleGenAI: () => any
  ): Promise<VisionAnalysisResult> {
    console.log("[VisionEngine] Received direct frame. Updating VisionManager and performing analysis.");
    try {
      const visionManager = VisionManager.getInstance();
      if (base64Image) {
        visionManager.updateFrame(base64Image);
      }

      const analysisText = await visionManager.captureAndAnalyzeScreen(query, getGoogleGenAI);

      const observedWindows: string[] = [];
      const commonApps = ["vscode", "chrome", "terminal", "notepad", "calculator", "browser", "spotify", "explorer", "github"];
      for (const app of commonApps) {
        if (analysisText.toLowerCase().includes(app)) {
          observedWindows.push(app);
        }
      }

      return {
        success: true,
        analysis: analysisText,
        observedWindows,
        timestamp: Date.now()
      };
    } catch (err: any) {
      console.error("[VisionEngine] Direct frame analysis failed:", err);
      return {
        success: false,
        analysis: `Failed to analyze screen: ${err.message}`,
        observedWindows: [],
        timestamp: Date.now()
      };
    }
  }
}
