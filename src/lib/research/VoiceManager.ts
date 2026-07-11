import { SimulatedEmotion } from "../../types";

export class VoiceManager {
  private static instance: VoiceManager;
  private preferredVoiceName: string = "";
  private lockedVoice: SpeechSynthesisVoice | null = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  private constructor() {
    this.initVoiceList();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        console.log("[VoiceManager] Speech voices updated.");
        this.lockPreferredVoice();
      };
    }
  }

  public static getInstance(): VoiceManager {
    if (!VoiceManager.instance) {
      VoiceManager.instance = new VoiceManager();
    }
    return VoiceManager.instance;
  }

  /**
   * Initializes and attempts to find/lock the preferred voice.
   */
  private initVoiceList() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    this.lockPreferredVoice();
  }

  /**
   * Scans available voices and locks the most appropriate high-quality female English voice.
   * Ensures she keeps a single, consistent identity.
   */
  public lockPreferredVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Check if we already have a locked voice that is still available
    if (this.lockedVoice) {
      const stillAvailable = voices.find(
        (v) => v.name === this.lockedVoice?.name && v.lang === this.lockedVoice?.lang
      );
      if (stillAvailable) {
        return stillAvailable;
      }
    }

    // Try to find preferred voices in order of visual/audio quality matching Liya's persona
    const searchPatterns = [
      "Google US English",
      "Microsoft Zira",
      "Samantha",
      "Microsoft Samantha",
      "Hazel",
      "Susan",
      "Victoria",
    ];

    for (const pattern of searchPatterns) {
      const match = voices.find(
        (v) =>
          v.name.toLowerCase().includes(pattern.toLowerCase()) &&
          (v.lang.toLowerCase().startsWith("en") || v.lang.toLowerCase().includes("us"))
      );
      if (match) {
        this.lockedVoice = match;
        this.preferredVoiceName = match.name;
        console.log(`[VoiceManager] Successfully locked preferred voice: ${match.name}`);
        return match;
      }
    }

    // Fallback: search for any english female or default english voice
    const fallbackMatch = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith("en") &&
        (v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("samantha"))
    );

    if (fallbackMatch) {
      this.lockedVoice = fallbackMatch;
      this.preferredVoiceName = fallbackMatch.name;
      console.log(`[VoiceManager] Locked onto fallback English voice: ${fallbackMatch.name}`);
      return fallbackMatch;
    }

    // General fallback: first English voice
    const englishVoice = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (englishVoice) {
      this.lockedVoice = englishVoice;
      this.preferredVoiceName = englishVoice.name;
      console.log(`[VoiceManager] Locked onto standard English voice: ${englishVoice.name}`);
      return englishVoice;
    }

    // Absolutely last option: first available voice
    if (voices.length > 0) {
      this.lockedVoice = voices[0];
      this.preferredVoiceName = voices[0].name;
      console.log(`[VoiceManager] Locked onto default system voice: ${voices[0].name}`);
      return voices[0];
    }

    return null;
  }

  /**
   * Helper to verify if the locked voice is currently available.
   * Returns true if verified, or attempts to restore.
   */
  public verifyVoiceLock(): { verified: boolean; voice: SpeechSynthesisVoice | null } {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return { verified: false, voice: null };
    }

    const voices = window.speechSynthesis.getVoices();
    if (this.lockedVoice) {
      const matched = voices.find((v) => v.name === this.lockedVoice?.name);
      if (matched) {
        return { verified: true, voice: matched };
      }
    }

    // Attempt restoration of preferred voice
    const restored = this.lockPreferredVoice();
    if (restored) {
      return { verified: true, voice: restored };
    }

    return { verified: false, voice: null };
  }

  /**
   * Analyzes the text and detects the appropriate emotional status of the response.
   */
  public detectEmotionFromText(text: string): SimulatedEmotion {
    const lower = text.toLowerCase();

    if (lower.includes("done!") || lower.includes("everything went smoothly") || lower.includes("perfect") || lower.includes("perfectly")) {
      return "happy";
    }
    if (lower.includes("give me a moment") || lower.includes("checking that") || lower.includes("let me see") || lower.includes("analyzing") || lower.includes("searching")) {
      return "thinking";
    }
    if (lower.includes("i've finished that") || lower.includes("successfully") || lower.includes("definitely") || lower.includes("completely")) {
      return "confident";
    }
    if (lower.includes("couldn't complete") || lower.includes("sorry") || lower.includes("apologize") || lower.includes("unfortunately")) {
      return "empathetic"; // or sad/apologetic representation
    }
    if (lower.includes("interesting idea") || lower.includes("wow") || lower.includes("excited") || lower.includes("awesome") || lower.includes("incredible")) {
      return "excited";
    }
    if (lower.includes("project updated successfully") || lower.includes("accomplished") || lower.includes("achievement")) {
      return "celebrating";
    }
    if (lower.includes("no problem") || lower.includes("calm") || lower.includes("sure") || lower.includes("anytime")) {
      return "neutral";
    }
    if (lower.includes("error") || lower.includes("fail") || lower.includes("crash") || lower.includes("warning")) {
      return "disappointed";
    }
    if (lower.includes("debugging") || lower.includes("compiler") || lower.includes("coding") || lower.includes("refactoring")) {
      return "confident";
    }

    return "neutral";
  }

  /**
   * Speaks the provided text using the locked voice with emotional adjustments.
   * Adheres strictly to the voice consistency & lock requirements.
   */
  public speak(
    text: string,
    emotion: SimulatedEmotion,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (errorText: string) => void
  ) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      if (onError) onError("Speech synthesis is not supported on this platform.");
      return;
    }

    // Cancel any active utterance
    window.speechSynthesis.cancel();

    // Verify voice lock
    const lockCheck = this.verifyVoiceLock();
    if (!lockCheck.verified || !lockCheck.voice) {
      const errorMsg = "Preferred voice profile 'Liya' is currently unavailable. Voice synthesis halted to preserve identity consistency.";
      console.warn(`[VoiceManager] ${errorMsg}`);
      if (onError) onError(errorMsg);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = lockCheck.voice;

    // Apply safe, subtle dynamic speech parameters based on emotions to sound more natural
    // We adjust pitch, rate and volume within tiny limits to maintain vocal identity
    let rate = 1.0;
    let pitch = 1.0;

    switch (emotion) {
      case "happy":
      case "excited":
      case "celebrating":
        rate = 1.08; // slightly faster
        pitch = 1.03; // slightly higher pitch
        break;
      case "thinking":
        rate = 0.93; // slower, reflective pacing
        pitch = 0.98;
        break;
      case "confident":
        rate = 1.02; // firm pacing
        pitch = 1.0;
        break;
      case "empathetic":
      case "sad":
      case "disappointed":
        rate = 0.92; // softer, slower
        pitch = 0.96;
        break;
      default:
        rate = 1.0;
        pitch = 1.0;
        break;
    }

    // Guarantee safety margins to avoid robotic/unstable outputs
    utterance.rate = Math.max(0.9, Math.min(1.15, rate));
    utterance.pitch = Math.max(0.95, Math.min(1.05, pitch));
    utterance.volume = 1.0;

    this.activeUtterance = utterance;

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (onEnd) onEnd();
      this.activeUtterance = null;
    };

    utterance.onerror = (e) => {
      console.error("[VoiceManager] Speech synthesis error:", e);
      if (onError) onError(`Speech synthesis error occurred: ${e.error}`);
      this.activeUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Immediately stops any speech output.
   */
  public stop() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.activeUtterance = null;
  }
}
