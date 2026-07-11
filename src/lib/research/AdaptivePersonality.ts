import { MemoryManager } from "./MemoryManager";
import { SimulatedEmotion } from "../../types";

export interface CorrectionRule {
  originalCommand: string;
  correctedCommand: string;
}

export class AdaptivePersonality {
  private static instance: AdaptivePersonality;
  private memoryManager = MemoryManager.getInstance();

  // In-memory transition tracker for predictive assistance (Feature 7)
  private lastExecutedAction: string = "";

  private constructor() {}

  public static getInstance(): AdaptivePersonality {
    if (!AdaptivePersonality.instance) {
      AdaptivePersonality.instance = new AdaptivePersonality();
    }
    return AdaptivePersonality.instance;
  }

  /**
   * Evaluates user input patterns to learn and adapt communication style (Feature 5).
   */
  public learnFromUserInput(text: string) {
    try {
      const trimmed = text.trim();
      const words = trimmed.split(/\s+/).length;
      
      const prevPreference = this.memoryManager.getSetting("user_style_preference", "standard");
      let newPreference = prevPreference;

      const techKeywords = ["compile", "npm", "git", "api", "function", "ts", "js", "build", "port", "sqlite", "query", "error", "exception"];
      const isTechQuery = techKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));

      if (isTechQuery) {
        newPreference = "technical";
      } else if (words <= 4 && !trimmed.includes("?")) {
        // User tends to give brief commands
        newPreference = "concise";
      } else if (words > 15 || trimmed.includes("explain") || trimmed.includes("how does") || trimmed.includes("why")) {
        // User values elaboration
        newPreference = "detailed";
      }

      if (newPreference !== prevPreference) {
        console.log(`[AdaptivePersonality] Communication style shifted from "${prevPreference}" to "${newPreference}". Saving preference.`);
        this.memoryManager.saveSetting("user_style_preference", newPreference);
      }
    } catch (err) {
      console.error("[AdaptivePersonality] Error adapting personality style:", err);
    }
  }

  /**
   * Retrieves preferred communication style profile.
   */
  public getPreferredStyle(): "standard" | "concise" | "detailed" | "technical" {
    return this.memoryManager.getSetting("user_style_preference", "standard");
  }

  /**
   * Implements Universal Command Memory (Feature 13).
   * Detects if the user is correcting a previous mistake or command, saving the override rule.
   */
  public detectAndRegisterCorrection(currentInput: string, lastCommand: string): boolean {
    const lower = currentInput.toLowerCase();
    
    // Pattern to detect correction: e.g., "no, open chrome", "no meant edge", "actually open..."
    const correctionPhrases = ["no, ", "no ", "actually ", "i meant", "incorrect", "wrong"];
    const isCorrection = correctionPhrases.some(phrase => lower.startsWith(phrase));

    if (isCorrection && lastCommand) {
      let cleanCorrection = currentInput;
      // Remove leading correction triggers for a cleaner target
      for (const phrase of correctionPhrases) {
        if (lower.startsWith(phrase)) {
          cleanCorrection = currentInput.slice(phrase.length).trim();
          break;
        }
      }

      // Save correction mapping in the database
      const corrections: Record<string, string> = this.memoryManager.getSetting("universal_command_corrections", {});
      const key = lastCommand.toLowerCase().trim();
      corrections[key] = cleanCorrection;
      
      this.memoryManager.saveSetting("universal_command_corrections", corrections);
      console.log(`[Universal Command Memory] Correction registered: "${key}" -> "${cleanCorrection}"`);
      return true;
    }

    return false;
  }

  /**
   * Applies corrective memory to incoming user commands.
   */
  public applyCommandCorrection(text: string): string {
    const corrections: Record<string, string> = this.memoryManager.getSetting("universal_command_corrections", {});
    const key = text.toLowerCase().trim();
    
    if (corrections[key]) {
      const corrected = corrections[key];
      console.log(`[Universal Command Memory] Command corrected dynamically: "${text}" -> "${corrected}"`);
      return corrected;
    }
    return text;
  }

  /**
   * Tracks active workflows to formulate optional, smart, non-annoying predictive hints (Feature 7).
   */
  public trackWorkflowAndSuggest(actionName: string): string | null {
    const previous = this.lastExecutedAction;
    this.lastExecutedAction = actionName.toLowerCase().trim();

    if (!previous) return null;

    // Retrieve previous transitions
    const transitionMatrix: Record<string, Record<string, number>> = this.memoryManager.getSetting("predictive_workflow_transitions", {});
    if (!transitionMatrix[previous]) {
      transitionMatrix[previous] = {};
    }

    // Increment count of the transition
    transitionMatrix[previous][actionName] = (transitionMatrix[previous][actionName] || 0) + 1;
    this.memoryManager.saveSetting("predictive_workflow_transitions", transitionMatrix);

    // Check if there is a dominant next action (happened > 2 times and constitutes > 65% of transitions)
    const targets = transitionMatrix[previous];
    let totalTransitions = 0;
    let topTarget = "";
    let topCount = 0;

    for (const [target, count] of Object.entries(targets)) {
      totalTransitions += count;
      if (count > topCount) {
        topCount = count;
        topTarget = target;
      }
    }

    if (topCount >= 2 && (topCount / totalTransitions) >= 0.65) {
      // Suggesting this step could be helpful
      return topTarget;
    }

    return null;
  }

  /**
   * Formulates a predictive suggestion sentence.
   */
  public getSuggestionText(action: string): string {
    const templates = [
      `I noticed you usually check on ${action} around this stage. Shall I do that for you?`,
      `Would you like me to open ${action} as well?`,
      `Since we just set up ${this.lastExecutedAction}, I can easily initialize ${action} next if you'd like.`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Enhances speech synthesis text with human-like micro-pauses, mild hesitations,
   * and emotional pacing without breaking voice model lock (Feature 3 & 12).
   */
  public prepareTextForSpeech(text: string, emotion: SimulatedEmotion): string {
    // 1. Strip markdown, code blocks, or technical tags to avoid TTS reading symbols aloud
    let clean = text
      .replace(/```[\s\S]*?```/g, " [showing some source code] ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~>|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 2. Select appropriate speech fillers/intonation depending on simulated emotion
    const style = this.getPreferredStyle();
    
    if (style === "concise") {
      // Keep verbal speech short and direct
      if (clean.length > 120) {
        clean = clean.split(/[.!?]/)[0] + ".";
      }
      return clean;
    }

    // Sparingly introduce natural human fillers and breath patterns (Feature 12)
    const seed = Math.random();
    let prefix = "";
    let suffix = "";

    switch (emotion) {
      case "thinking":
        if (seed < 0.4) {
          prefix = "Hm, let's see... ";
        } else if (seed < 0.8) {
          prefix = "Well, ... looking into that ... ";
        }
        break;
      case "happy":
      case "excited":
      case "celebrating":
        if (seed < 0.5) {
          prefix = "Oh, awesome! ";
        } else {
          prefix = "Great news, ... ";
        }
        break;
      case "confident":
        if (seed < 0.3) {
          prefix = "Alright, ... ";
        }
        break;
      case "empathetic":
      case "disappointed":
        if (seed < 0.5) {
          prefix = "Ah, sorry about that... ";
        } else {
          prefix = "Oh, I see... ";
        }
        break;
      default:
        if (seed < 0.15) {
          prefix = "Alright, ";
        }
        break;
    }

    // Insert minor speaking hesitations or organic pauses (expressed via ellipses and commas)
    let pacedText = prefix + clean + suffix;
    
    // Add micro-pauses before logical conjunctions (but, and, so) to sound human
    pacedText = pacedText
      .replace(/, but/gi, ", ... but")
      .replace(/, and/gi, ", ... and")
      .replace(/so, /gi, "so, ... ");

    return pacedText;
  }
}
