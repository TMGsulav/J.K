import { SimulatedEmotion, AssistantState } from "../types";

export interface EmotionMetrics {
  emoji: string;
  avatarColor: string; // Tailwind border or glow colors
  expression: string;
  floatingSpeed: number; // Idle floating animation speed multiplier
  particleRate: number; // Emitted particles for voice orb
}

export const EMOTION_MAP: Record<SimulatedEmotion, EmotionMetrics> = {
  neutral: {
    emoji: "😐",
    avatarColor: "rgba(100, 116, 139, 0.4)", // Slate
    expression: "Neutral, calm posture.",
    floatingSpeed: 1.0,
    particleRate: 1
  },
  happy: {
    emoji: "😊",
    avatarColor: "rgba(34, 197, 94, 0.5)", // Green
    expression: "Warm smile and light swaying.",
    floatingSpeed: 1.2,
    particleRate: 3
  },
  sad: {
    emoji: "😔",
    avatarColor: "rgba(59, 130, 246, 0.4)", // Blue
    expression: "Downcast look, slower breathing.",
    floatingSpeed: 0.7,
    particleRate: 0
  },
  thinking: {
    emoji: "🤔",
    avatarColor: "rgba(168, 85, 247, 0.5)", // Purple
    expression: "Focused expression, tilting head slightly.",
    floatingSpeed: 0.9,
    particleRate: 2
  },
  listening: {
    emoji: "👂",
    avatarColor: "rgba(236, 72, 153, 0.6)", // Pink
    expression: "Eyes focused, tilting slightly forward.",
    floatingSpeed: 1.1,
    particleRate: 4
  },
  excited: {
    emoji: "😁",
    avatarColor: "rgba(234, 179, 8, 0.6)", // Yellow
    expression: "Big smile, energetic hover bouncing.",
    floatingSpeed: 1.6,
    particleRate: 6
  },
  curious: {
    emoji: "🧐",
    avatarColor: "rgba(20, 184, 166, 0.5)", // Teal
    expression: "Inquisitive posture, leaning in.",
    floatingSpeed: 1.1,
    particleRate: 2
  },
  empathetic: {
    emoji: "🤗",
    avatarColor: "rgba(244, 63, 94, 0.5)", // Rose
    expression: "Soft, reassuring and comforting smile.",
    floatingSpeed: 0.85,
    particleRate: 1
  },
  confident: {
    emoji: "😎",
    avatarColor: "rgba(99, 102, 241, 0.6)", // Indigo
    expression: "Upright, self-assured stance.",
    floatingSpeed: 1.3,
    particleRate: 4
  },
  disappointed: {
    emoji: "😞",
    avatarColor: "rgba(239, 68, 68, 0.4)", // Red
    expression: "Slight sigh, shoulders relaxed down.",
    floatingSpeed: 0.6,
    particleRate: 0
  },
  encouraging: {
    emoji: "💪",
    avatarColor: "rgba(16, 185, 129, 0.5)", // Emerald
    expression: "Determined gaze, encouraging head nod.",
    floatingSpeed: 1.3,
    particleRate: 3
  },
  celebrating: {
    emoji: "🎉",
    avatarColor: "rgba(249, 115, 22, 0.6)", // Orange
    expression: "Cheerful spins and excited jumps.",
    floatingSpeed: 1.8,
    particleRate: 8
  }
};

/**
 * Determine the next simulated emotion based on assistant state,
 * dialogue text, and tool execution outcomes.
 */
export function determineEmotion(
  state: AssistantState,
  text: string,
  lastToolSuccess?: boolean
): SimulatedEmotion {
  // 1. High-priority state-based mappings
  if (state === "thinking" || state === "executing_tool") {
    return "thinking";
  }
  if (state === "listening") {
    return "listening";
  }
  if (state === "error" || state === "interrupted") {
    return "disappointed";
  }

  // 2. Check tool call success/failure outcomes
  if (lastToolSuccess === true) return "happy";
  if (lastToolSuccess === false) return "sad";

  // 3. Text sentiment analysis for natural responses
  const cleanText = text.toLowerCase();
  
  if (cleanText.includes("fail") || cleanText.includes("error") || cleanText.includes("sorry") || cleanText.includes("unfortunately")) {
    return "sad";
  }
  if (cleanText.includes("great") || cleanText.includes("awesome") || cleanText.includes("perfect") || cleanText.includes("congratulations")) {
    return "celebrating";
  }
  if (cleanText.includes("yes") || cleanText.includes("absolutely") || cleanText.includes("sure") || cleanText.includes("confident")) {
    return "confident";
  }
  if (cleanText.includes("can you") || cleanText.includes("how") || cleanText.includes("why") || cleanText.includes("what")) {
    return "curious";
  }
  if (cleanText.includes("wow") || cleanText.includes("excited") || cleanText.includes("amazing") || cleanText.includes("unbelievable")) {
    return "excited";
  }
  if (cleanText.includes("support") || cleanText.includes("help") || cleanText.includes("here for you") || cleanText.includes("understand")) {
    return "empathetic";
  }
  if (cleanText.includes("try again") || cleanText.includes("keep going") || cleanText.includes("you can do it")) {
    return "encouraging";
  }
  if (cleanText.includes("hello") || cleanText.includes("hi") || cleanText.includes("welcome")) {
    return "happy";
  }

  return "neutral";
}
