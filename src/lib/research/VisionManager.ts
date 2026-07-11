import { GoogleGenAI } from "@google/genai";
import { MemoryManager } from "./MemoryManager";
import { callWithRetry } from "./GeminiRetry";

export interface VisionFrame {
  data: string; // base64 JPEG
  timestamp: number;
}

export class VisionManager {
  private static instance: VisionManager;
  private memoryManager = MemoryManager.getInstance();

  private latestFrame: VisionFrame | null = null;
  private previousFrame: VisionFrame | null = null;

  private frameResolver: ((frame: string) => void) | null = null;
  private screenSharingActive: boolean = false;

  private constructor() {}

  public static getInstance(): VisionManager {
    if (!VisionManager.instance) {
      VisionManager.instance = new VisionManager();
    }
    return VisionManager.instance;
  }

  /**
   * Track whether active screen sharing is enabled/disabled.
   * If screen sharing stops, we immediately clear/purge all frames.
   */
  public setScreenSharingActive(active: boolean): void {
    console.log(`[VisionManager] Screen sharing active set to: ${active}`);
    this.screenSharingActive = active;
    if (!active) {
      this.clearFrames();
    }
  }

  public isScreenSharingActive(): boolean {
    return this.screenSharingActive;
  }

  /**
   * Purges all cached screen frames immediately on screen share stop to protect privacy
   * and ensure stale screenshots are never reused.
   */
  public clearFrames(): void {
    console.log("[VisionManager] Purging all screen frames and cached images.");
    this.latestFrame = null;
    this.previousFrame = null;
  }

  /**
   * Continuous background update feed: Stores the latest JPEG frame base64 data.
   * Promotes the old latest frame to previousFrame to support change detection.
   */
  public updateFrame(base64Image: string): void {
    if (!base64Image) return;

    if (this.latestFrame) {
      // Shift old frame to support consecutive frame comparison / change detection
      this.previousFrame = { ...this.latestFrame };
    }

    this.latestFrame = {
      data: base64Image,
      timestamp: Date.now(),
    };

    // Resolve any pending on-demand capture requests
    if (this.frameResolver) {
      const resolver = this.frameResolver;
      this.frameResolver = null;
      resolver(base64Image);
    }
  }

  public getLatestFrame(): VisionFrame | null {
    return this.latestFrame;
  }

  public getPreviousFrame(): VisionFrame | null {
    return this.previousFrame;
  }

  /**
   * Requests a fresh frame from the client via WebSocket and blocks until it is received or times out.
   */
  public async requestFreshFrame(wsSender: (payload: any) => void): Promise<string | null> {
    console.log("[VisionManager] Prompting client for instant capture...");
    
    return new Promise((resolve) => {
      // 1-second timeout as the absolute ceiling to maintain fast conversational fluidity
      const timeout = setTimeout(() => {
        this.frameResolver = null;
        console.warn("[VisionManager] Timed out waiting for client frame response.");
        resolve(null);
      }, 1000);

      this.frameResolver = (frameData: string) => {
        clearTimeout(timeout);
        resolve(frameData);
      };

      // Request client to send an immediate capture
      wsSender({ type: "requestFrame" });
    });
  }

  /**
   * Force captures a fresh, true live frame. Verifies screen sharing is active,
   * requests capture, and asserts the frame is newer than 1 second old.
   */
  public async getTrueLiveFrame(wsSender?: (payload: any) => void): Promise<string> {
    if (!this.screenSharingActive) {
      throw new Error("I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.");
    }

    if (!wsSender) {
      throw new Error("I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.");
    }

    // Force capture fresh frame
    const freshData = await this.requestFreshFrame(wsSender);
    if (!freshData) {
      throw new Error("I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.");
    }

    // Verify timestamp freshness (< 1 second old)
    if (!this.latestFrame) {
      throw new Error("I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.");
    }

    const frameAge = Date.now() - this.latestFrame.timestamp;
    if (frameAge > 1000) {
      throw new Error("I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.");
    }

    return freshData;
  }

  /**
   * Captures the screen, guarantees frame freshness, and analyzes screen content using Gemini.
   */
  public async captureAndAnalyzeScreen(
    query: string = "Analyze the screenshot and summarize the active windows/content.",
    getGoogleGenAI: () => any,
    wsSender?: (payload: any) => void
  ): Promise<string> {
    console.log(`[VisionManager] Coordinating screen analysis for query: "${query}"`);
    const startTime = Date.now();

    try {
      const ai = getGoogleGenAI();
      if (!ai) {
        throw new Error("AI engine is unavailable (Gemini SDK not initialized)");
      }

      // Fetch the true live frame
      let base64Image: string;
      try {
        base64Image = await this.getTrueLiveFrame(wsSender);
      } catch (err: any) {
        return err.message; // Returns the exact required error string
      }

      const activeProjId = this.memoryManager.getSetting("active_project_id", process.cwd());
      const prompt = `You are Liya's high-fidelity Vision Engine.
Analyze the provided screenshot carefully.
User query/interest: "${query}"
Active Project Path: "${activeProjId}"

Instructions:
1. Identify the open windows, applications, editor file, terminal outputs, or key visuals present in the image.
2. Note any errors, bugs, or compiler failures visible in the layout.
3. Draft a precise, highly human-like, conversational description of what is active.
4. Integrate this context with the project's state.

Return your response in a clear, well-structured layout. Avoid dry computer-like metadata declarations; keep it clean and conversational.`;

      const response: any = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Image } }
              ]
            }
          ]
        })
      );

      const analysisText = response.text?.trim() || "Analyzed screenshot but no details extracted.";

      // Extract active applications using heuristics
      const observedWindows: string[] = [];
      const commonApps = ["vscode", "chrome", "terminal", "notepad", "calculator", "browser", "spotify", "explorer", "github"];
      for (const app of commonApps) {
        if (analysisText.toLowerCase().includes(app)) {
          observedWindows.push(app);
        }
      }

      // Update active foreground application setting
      const activeAppName = observedWindows.length > 0 ? observedWindows[0] : "Unknown App";
      this.memoryManager.saveSetting("active_app", activeAppName);

      console.log(`[VisionManager] Visual analysis completed in ${Date.now() - startTime}ms. Live frame used: true. Apps detected: ${JSON.stringify(observedWindows)}`);
      return analysisText;

    } catch (err: any) {
      console.error("[VisionManager] Screen visual analysis failed:", err);
      return "I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.";
    }
  }

  /**
   * Compares consecutive frames (previousFrame vs latestFrame) using Gemini to explain what changed.
   */
  public async compareFramesAndAnalyze(
    getGoogleGenAI: () => any,
    wsSender?: (payload: any) => void
  ): Promise<string> {
    if (!this.screenSharingActive) {
      return "I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.";
    }

    console.log("[VisionManager] Forcing immediate frame capture before change comparison...");
    try {
      if (wsSender) {
        await this.getTrueLiveFrame(wsSender);
      }
    } catch (err: any) {
      return err.message; // Returns the exact required error string
    }

    if (!this.previousFrame || !this.latestFrame) {
      return "I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.";
    }

    console.log("[VisionManager] Comparing consecutive frames for active workspace changes...");
    const startTime = Date.now();

    try {
      const ai = getGoogleGenAI();
      if (!ai) {
        throw new Error("AI engine is unavailable (Gemini SDK not initialized)");
      }

      const prompt = `You are Liya's Live Screen Change Detector.
Analyze and compare the two consecutive screenshots of the user's screen carefully.
- Image 1: The previous screen state.
- Image 2: The current screen state (the latest frame).

Your objective is to identify and describe any active transitions or changes that just occurred. Specifically look for:
1. Active window or application switches (e.g., from VS Code to Chrome browser, or terminal opened).
2. Browser tab transitions or loading a new website.
3. Newly opened modal dialogs, prompt dialogs, or error alerts.
4. Compiler/terminal logs or active file switches in the text editor.
5. New folders or folder navigations in File Explorer.

Explain what changed in a precise, helpful, human-like, conversational tone as Liya. Be direct and avoid dry technical metadata wrappers.`;

      const response: any = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: this.previousFrame!.data } },
                { inlineData: { mimeType: "image/jpeg", data: this.latestFrame!.data } }
              ]
            }
          ]
        })
      );

      const comparisonText = response.text?.trim() || "Analyzed consecutive screen captures but no workspace changes were detected.";
      console.log(`[VisionManager] Frame comparison analysis completed in ${Date.now() - startTime}ms.`);
      return comparisonText;

    } catch (err: any) {
      console.error("[VisionManager] Frame comparison failed:", err);
      return "I don't currently have access to a fresh screen frame. I'm reconnecting to the live screen.";
    }
  }
}
