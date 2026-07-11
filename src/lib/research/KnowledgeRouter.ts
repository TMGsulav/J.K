import { GoogleGenAI } from "@google/genai";
import { getCustomTTL, SearchCache } from "./SearchCache";

export interface KnowledgeRoute {
  level: 1 | 2 | 3;
  reason: string;
  primaryQuery: string;
  subQueries: string[];
  freshness: "live" | "24h" | "7d" | "30d" | "all";
  requiresSearch: boolean;
}

export class KnowledgeRouter {
  private static DYNAMIC_KEYWORDS = [
    // Weather
    "weather", "temperature", "forecast", "rain", "snow", "wind", "humidity", "climate", "degree",
    // News & sports
    "news", "headline", "sport", "match", "score", "game", "winner", "olympics", "championship",
    // Financial / Prices
    "stock", "market", "crypto", "bitcoin", "ethereum", "price", "rate", "exchange", "dollar", "euro",
    // Politics / Current leaders
    "prime minister", "president", "chancellor", "election", "minister", "cabinet", "government", "mayor",
    // AI model releases
    "ai model", "gpt", "gemini", "claude", "deepseek", "llama", "chatgpt", "midjourney", "latest version",
    // Live / Current / Today
    "today", "yesterday", "current", "latest", "now", "live", "recent", "recent announcement", "death of", "who is currently"
  ];

  private static DEEP_RESEARCH_KEYWORDS = [
    // Comparison
    "compare", "comparison", "difference between", "vs", "versus", "pros and cons", "advantages of", "better", "best of",
    // Frameworks & tech stacks
    "framework", "library", "react", "vue", "angular", "next.js", "nuxt", "svelte", "express", "fastapi", "django", "drizzle", "prisma", "orm",
    // Medical / Science / Academic
    "medical research", "study on", "clinical trial", "treatment for", "scientific study", "academic paper", "research on", "analysis of",
    // Product evaluation
    "product review", "laptop review", "gpu review", "best smartphone", "benchmark", "buy a", "which is better",
    // Complex systems
    "architecture of", "how to implement a complex", "deep-dive", "comprehensive guide"
  ];

  /**
   * Fast, local heuristics to determine knowledge level before invoking LLM classifiers.
   */
  public static classifyHeuristic(text: string): { level: 1 | 2 | 3; reason: string } | null {
    const q = text.toLowerCase().trim();
    if (!q) return { level: 1, reason: "Empty query" };

    // 1. Sulav / Creator Identity queries (Level 1 - Stable / Local)
    if (/\b(sulav|creator|developer|owner|builder|inventor)\b/i.test(q)) {
      const isOther = /\b(another sulav|different sulav|other sulav|sulav who|sulav from)\b/i.test(q);
      if (!isOther) {
        return { level: 1, reason: "Identity of creator/developer is stable local knowledge" };
      }
    }

    // 2. Math calculations & Basic Code snippets (Level 1)
    const isMath = /^[0-9+\-*/\s().]+$/.test(q) || (/\b(calculate|plus|minus|multiplied|divided|sqrt|factorial|sum|equation)\b/i.test(q) && /\d+/.test(q));
    if (isMath) {
      return { level: 1, reason: "Mathematical calculations are Level 1 stable facts" };
    }

    // 3. Coding requests & programming language basic concepts (Level 1)
    if (/\b(write a function|create a class|binary search|sorting algorithm|how to declare|hello world|reverse a string|fibonacci|regex pattern|sql query to select|regex to match)\b/i.test(q)) {
      return { level: 1, reason: "Standard coding/programming concepts are stable knowledge" };
    }

    // 4. Basic General Conversation & Greetings (Level 1)
    if (/^(hello|hi|hey|how are you|good morning|good afternoon|good evening|who are you|what is your name|thank you|thanks|bye|goodbye)\b/i.test(q)) {
      return { level: 1, reason: "Conversational greetings are Level 1" };
    }

    return null;
  }

  /**
   * Categorizes the query using Gemini or heuristics into Level 1, 2, or 3.
   */
  public static async classify(
    query: string,
    getAI: () => GoogleGenAI | null
  ): Promise<KnowledgeRoute> {
    const startTime = Date.now();
    
    // Check heuristic classifier first (<1ms)
    const heuristic = this.classifyHeuristic(query);
    if (heuristic) {
      console.log(`[KnowledgeRouter] Heuristic Classification: Level ${heuristic.level} (${heuristic.reason}) in ${Date.now() - startTime}ms`);
      return {
        level: heuristic.level,
        reason: heuristic.reason,
        primaryQuery: query,
        subQueries: [query],
        freshness: "all",
        requiresSearch: false
      };
    }

    // Default route
    const defaultRoute: KnowledgeRoute = {
      level: 1,
      reason: "Default stable knowledge classification",
      primaryQuery: query,
      subQueries: [query],
      freshness: "all",
      requiresSearch: false
    };

    const ai = getAI();
    if (!ai) {
      console.log("[KnowledgeRouter] Gemini AI unavailable, falling back to heuristic / keyword scanner");
      return this.keywordClassifier(query);
    }

    try {
      const { callWithRetry, robustParseJSON } = await import("./GeminiRetry");
      
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Analyze this user query: "${query}"
Task:
Classify the query into one of three Knowledge Levels:

Level 1 - Stable Knowledge:
- Standard factual facts, historical events, science, basic programming/coding concepts, standard language grammar, math, geographical facts, biographies of historical figures.
- Examples: "Who was Charles Babbage?", "What is HTML/CSS?", "Write binary search in Python", "How far is the sun?", "When was America discovered?".
- Rule: Bypasses web search. Answered directly via internal knowledge or cache.

Level 2 - Dynamic Knowledge:
- Real-time/current information, latest events, sports scores, weather forecasts, stock/crypto prices, current prime ministers/presidents, recent AI model releases, current news.
- Examples: "Who is the Prime Minister of UK today?", "Weather in Tokyo", "What is BTC price?", "Latest news on SpaceX", "Is Gemini 1.5 out?".
- Rule: Requires quick live web search.

Level 3 - Deep Research:
- Comparing products, researching new technologies, in-depth academic topics, complex programming frameworks/tooling tutorials, medical research, detailed comparison of libraries.
- Examples: "Compare iPhone 15 vs Samsung S24", "How to set up Drizzle ORM with CJS/ESM bundling in Express", "Recent medical research on AI cancer detection", "Explain differences between React and Vue in 2026".
- Rule: Requires extensive search and reading multiple pages in-depth.

Return your analysis as a valid JSON object matching this schema:
{
  "level": 1 | 2 | 3,
  "reason": "short explanation of classification choice",
  "primaryQuery": "optimized keyword-based search query",
  "subQueries": ["up to 3 optimized parallel sub-queries for research (only if level 3)"],
  "freshness": "live" | "24h" | "7d" | "30d" | "all"
}`,
          config: {
            responseMimeType: "application/json"
          }
        })
      );

      const text = response.text?.trim();
      if (text) {
        const parsed = robustParseJSON(text);
        const level = (parsed.level === 1 || parsed.level === 2 || parsed.level === 3) ? parsed.level as 1 | 2 | 3 : 1;
        const requiresSearch = level > 1;

        console.log(`[KnowledgeRouter] LLM Classification: Level ${level} (${parsed.reason}) in ${Date.now() - startTime}ms`);

        return {
          level,
          reason: parsed.reason || "Classified via Gemini",
          primaryQuery: parsed.primaryQuery || query,
          subQueries: Array.isArray(parsed.subQueries) && parsed.subQueries.length > 0 ? parsed.subQueries : [parsed.primaryQuery || query],
          freshness: parsed.freshness || "all",
          requiresSearch
        };
      }
    } catch (e) {
      console.error("[KnowledgeRouter] Gemini classification failed, falling back to keyword scanner:", e);
    }

    return this.keywordClassifier(query);
  }

  /**
   * Simple regex / keyword scanner used as an offline/error fallback.
   */
  private static keywordClassifier(query: string): KnowledgeRoute {
    const q = query.toLowerCase();
    
    // Check Deep Research first
    for (const kw of this.DEEP_RESEARCH_KEYWORDS) {
      if (q.includes(kw)) {
        return {
          level: 3,
          reason: `Matches Deep Research keyword: "${kw}"`,
          primaryQuery: query,
          subQueries: [query],
          freshness: "all",
          requiresSearch: true
        };
      }
    }

    // Check Dynamic Search
    for (const kw of this.DYNAMIC_KEYWORDS) {
      if (q.includes(kw)) {
        return {
          level: 2,
          reason: `Matches Dynamic Search keyword: "${kw}"`,
          primaryQuery: query,
          subQueries: [query],
          freshness: q.includes("weather") || q.includes("price") ? "live" : "30d",
          requiresSearch: true
        };
      }
    }

    return {
      level: 1,
      reason: "Classified as Stable Knowledge via keyword scanner",
      primaryQuery: query,
      subQueries: [query],
      freshness: "all",
      requiresSearch: false
    };
  }
}
