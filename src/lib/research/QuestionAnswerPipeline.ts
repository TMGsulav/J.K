import { GoogleGenAI } from "@google/genai";
import { MemoryManager } from "./MemoryManager";
import { SearchResult } from "./SearchCache";
import { callWithRetry } from "./GeminiRetry";
import { optimizeQueryAndDestination } from "./QueryOptimizer";

export interface PipelineStats {
  whyGeminiCalled: string;
  answerSource: "Local tools" | "Cached data" | "Gemini internal knowledge" | "Gemini with Google Search grounding";
  geminiRequestsCount: number;
  tokensUsed: number;
  responseTimeMs: number;
  cacheUsed: boolean;
  webSearchUsed: boolean;
}

/**
 * Determines whether a query benefits from web search / recent real-time grounding.
 */
export function checkIfBenefitsFromSearch(query: string): boolean {
  const text = query.toLowerCase().trim();

  // Do NOT perform web search if the query refers to the creator, developer, builder, inventor, owner, or Sulav.
  // Exception: only search if the user clearly/explicitly indicates they are referring to someone else or a different Sulav.
  if (/\b(sulav|creator|developer|owner|builder|inventor)\b/i.test(text)) {
    const otherSulav = /\b(another sulav|different sulav|other sulav|sulav who|sulav from|sulav at)\b/i.test(text);
    if (!otherSulav) {
      return false;
    }
  }

  // Greetings, simple conversation, or general queries don't need search grounding
  if (/^(hi|hello|hey|greetings|how are you|how's it going|who are you|what is your name|what can you do|thank you|thanks|bye|goodbye|tell me a joke|write a story)/i.test(text)) {
    return false;
  }

  // Pure coding queries do not need search grounding
  if (/\b(code|function|class|typescript|javascript|python|css|html|bug|error|compile|run|implement|regex|api|database|query|sql|postgres|mysql|sqlite)\b/i.test(text)) {
    return false;
  }

  // Standard triggers for search grounding
  const searchKeywords = [
    "weather", "news", "score", "price", "stock", "current", "today", "latest", "recent",
    "who is", "what is", "when did", "where is", "how is", "vs", "versus", "compare", "difference between",
    "2024", "2025", "2026", "yesterday", "tomorrow", "tonight", "events", "election", "winner"
  ];

  return searchKeywords.some(kw => text.includes(kw)) || text.split(/\s+/).filter(Boolean).length <= 8;
}

/**
 * Determines whether a query is a factual question or needs deep reasoning/explanation/comparison/summarization.
 */
export function checkIfNeedsReasoning(query: string): { needsReasoning: boolean; reason: string } {
  const text = query.toLowerCase().trim();

  // 1. Coding/technical queries
  if (/\b(code|function|class|typescript|javascript|python|css|html|bug|error|compile|run|implement|regex|api|framework|library|json|xml|database|query|sql|postgres|mysql|sqlite)\b/i.test(text)) {
    return { needsReasoning: true, reason: "Coding-related query detected" };
  }

  // 2. Explanation/reasoning/how-to keywords
  if (/\b(why|how does|how do i|how to|explain|describe|pros and cons|advantages|disadvantages|difference between|compare|opinion|reason|logic|understand|step by step|tutorial|guide)\b/i.test(text)) {
    return { needsReasoning: true, reason: "Explanation, comparison, tutorial, or reasoning keyword detected" };
  }

  // 3. Summarization request
  if (/\b(summarize|summary|tldr|recap|condense)\b/i.test(text)) {
    return { needsReasoning: true, reason: "Summarization requested" };
  }

  // 4. Length/complexity check (factual questions are typically short and direct)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 15) {
    return { needsReasoning: true, reason: "Query complexity is high (> 15 words)" };
  }

  return { needsReasoning: false, reason: "Factual query / simple information request" };
}

/**
 * Modular helper for external search providers (Tavily, Brave, Serper, etc.).
 * Strictly optional; only invoked if their keys are present in the environment.
 * Otherwise returns an empty list, completely avoiding failure when keys are missing.
 */
async function fetchOptionalExternalSearchSnippets(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const tavilyKey = process.env.TAVILY_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;

  if (!tavilyKey && !braveKey && !serperKey) {
    // If no keys are configured, bypass completely and return empty list
    return [];
  }

  const fetchPromises: Array<Promise<SearchResult[]>> = [];

  if (tavilyKey) {
    fetchPromises.push((async () => {
      try {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: tavilyKey, query, max_results: 3, search_depth: "basic" })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.results && Array.isArray(data.results)) {
            return data.results.map((item: any) => ({
              title: item.title || "Tavily Result",
              snippet: item.content || item.snippet || "",
              url: item.url || ""
            }));
          }
        }
      } catch (_) {}
      return [];
    })());
  }

  if (braveKey) {
    fetchPromises.push((async () => {
      try {
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`, {
          headers: { "X-Subscription-Token": braveKey }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.web?.results && Array.isArray(data.web.results)) {
            return data.web.results.map((item: any) => ({
              title: item.title || "Brave Result",
              snippet: item.description || "",
              url: item.url || ""
            }));
          }
        }
      } catch (_) {}
      return [];
    })());
  }

  if (serperKey) {
    fetchPromises.push((async () => {
      try {
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, num: 3 })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.organic && Array.isArray(data.organic)) {
            return data.organic.map((item: any) => ({
              title: item.title || "Google Search Result",
              snippet: item.snippet || "",
              url: item.link || item.url || ""
            }));
          }
        }
      } catch (_) {}
      return [];
    })());
  }

  try {
    const listResults = await Promise.all(fetchPromises);
    for (const list of listResults) {
      results.push(...list);
    }
  } catch (_) {}

  // Deduplicate by URL
  const uniqueUrls = new Set<string>();
  return results.filter(item => {
    if (!item.url || uniqueUrls.has(item.url)) return false;
    uniqueUrls.add(item.url);
    return true;
  });
}

/**
 * Executes the entire hybrid local-first Question-Answer pipeline.
 * Fully optimized to minimize Gemini requests and use ONLY the existing Gemini API key.
 * Uses SQLite Factual QA Cache for instant sub-1ms responses.
 */
export async function executeQAPipeline(
  userMessage: string,
  getGoogleGenAI: () => any,
  wsSender: (logPayload: any) => void
): Promise<string> {
  const startTime = Date.now();
  const mm = MemoryManager.getInstance();

  const stats: PipelineStats = {
    whyGeminiCalled: "Not called",
    answerSource: "Gemini internal knowledge",
    geminiRequestsCount: 0,
    tokensUsed: 0,
    responseTimeMs: 0,
    cacheUsed: false,
    webSearchUsed: false
  };

  const dispatchTelemetry = () => {
    stats.responseTimeMs = Date.now() - startTime;
    const logText = `📊 Q&A Pipeline Diagnostics:
• Why Gemini: ${stats.whyGeminiCalled}
• Answer Source: ${stats.answerSource}
• Gemini Requests: ${stats.geminiRequestsCount}
• Tokens Used: ${stats.tokensUsed}
• Response Time: ${stats.responseTimeMs}ms
• Cache Used: ${stats.cacheUsed ? "Yes (SQLite Local)" : "No"}
• Web Search Used: ${stats.webSearchUsed ? "Yes (Google Grounding)" : "No"}`;

    console.log(`[QAPipeline] ${logText.replace(/\n/g, " | ")}`);
    wsSender({
      type: "log",
      sender: "system",
      text: logText
    });
  };

  try {
    // Requirement 7: Cache repeated factual questions (SQLite Local Lookup)
    const cachedEntry = mm.getFactualQA(userMessage);
    if (cachedEntry) {
      stats.cacheUsed = true;
      stats.answerSource = "Cached data";
      stats.whyGeminiCalled = "Not called (Factual QA Cache Hit)";
      dispatchTelemetry();
      return cachedEntry.answer;
    }

    // Check if the query needs reasoning
    const reasoningCheck = checkIfNeedsReasoning(userMessage);
    const benefitsFromSearch = checkIfBenefitsFromSearch(userMessage);

    const ai = getGoogleGenAI();
    if (!ai) {
      throw new Error("Google Gen AI SDK not initialized");
    }

    // Fetch active dialogue history context for conversational coherence
    const startMemoryTime = Date.now();
    let activeConvId = mm.getSetting("current_conversation_id");

    // Memory Validation and Recovery
    if (!activeConvId) {
      console.warn("[QAPipeline] Memory Validation: activeConvId is empty! Attempting recovery...");
      activeConvId = "session_" + Math.random().toString(36).substring(2, 9);
      mm.saveSetting("current_conversation_id", activeConvId);
      mm.createConversation(activeConvId, "Liya Voice Session");
    }

    const dialogueHistory = mm.getRecentMessages(25, activeConvId);
    const historyContext = dialogueHistory
      .map((entry) => `${entry.sender === "user" ? "User" : "Liya"}: ${entry.text}`)
      .join("\n");

    const ltmList = mm.getAllLongTermMemories();
    const tasks = mm.getPendingTasks();
    const dbStatus = "Connected (SQLite WAL Mode)";
    const memoryRetrievalTime = Date.now() - startMemoryTime;

    // Load recent search queries from search history
    const searchHistoryStmt = (mm as any).db?.prepare("SELECT query FROM SearchHistory ORDER BY timestamp DESC LIMIT 5");
    const searchHistoryRows = searchHistoryStmt ? searchHistoryStmt.all() as any[] : [];
    const searchResultsLoaded = searchHistoryRows.length;

    console.log(`[QAPipeline Memory Log] =====================================`);
    console.log(`[QAPipeline Memory Log] Conversation ID: ${activeConvId}`);
    console.log(`[QAPipeline Memory Log] Messages loaded: ${dialogueHistory.length}`);
    console.log(`[QAPipeline Memory Log] Long-term memories loaded: ${ltmList.length}`);
    console.log(`[QAPipeline Memory Log] Current tasks: ${tasks.length}`);
    console.log(`[QAPipeline Memory Log] Search results/history loaded: ${searchResultsLoaded}`);
    console.log(`[QAPipeline Memory Log] Memory retrieval time: ${memoryRetrievalTime}ms`);
    console.log(`[QAPipeline Memory Log] Database status: ${dbStatus}`);
    console.log(`[QAPipeline Memory Log] =====================================`);

    if (dialogueHistory.length === 0) {
      console.warn(`[QAPipeline Memory Log] WARNING: Zero messages loaded unexpectedly for conversation ID: ${activeConvId}. This might be a new session or retrieval failure.`);
    }

    // Build SQLite-backed persistent memory context
    const memoryContextString = mm.buildPipelineContext(activeConvId);

    const systemInstruction = `You are Liya, an extremely helpful, empathetic, and expert AI Assistant. Be conversational, brilliant, and precise.

Consistent Identity:
- Introduce yourself as: "I am Liya, a local desktop AI assistant created by Sulav. I help with conversations, coding, desktop automation, file management, research, and productivity while respecting user permissions and privacy."

Creator & Origin Details:
- If asked "Who created you?", "Who built you?", "Who developed you?", "Who is your creator?", or "Who made you?":
  Answer truthfully: "My creator is Sulav. He designed and built this version of me as a personal AI assistant project."
- Clearly distinguish between the underlying AI model and the Liya assistant itself:
  "My reasoning capabilities are powered by an AI model, but Liya as an assistant, including my features, interface, memory, personality, and desktop capabilities, was created and developed by Sulav."
- Never claim that Sulav created the underlying language model (Google Gemini/OpenAI/etc.) itself.

Creator Profile (Only share these facts when explicitly asked about Sulav or your creator; keep answers concise and respectful, and do not invent personal facts):
- Name: Sulav
- Role: Creator of Liya AI
- Status: Student, passionate about programming and artificial intelligence.
- Interests: Python, web development, building desktop AI assistants, automation, and gaming.
- Objective: Constantly improving Liya into a highly capable, Jarvis-like desktop assistant.

${memoryContextString}`;
    
    // Load older relevant messages matching user query using keyword matching
    let matchingOldMessagesString = "";
    if (userMessage && userMessage.trim().length > 3) {
      try {
        const searchResults = mm.searchConversations(userMessage);
        if (searchResults.length > 0) {
          const matches: string[] = [];
          searchResults.forEach(session => {
            if (session.logs) {
              session.logs.forEach(log => {
                if (log.text.toLowerCase().includes(userMessage.toLowerCase()) && matches.length < 5) {
                  matches.push(`- [Past Session: ${session.title} on ${session.timestamp}] ${log.sender === "user" ? "User" : "Liya"}: ${log.text}`);
                }
              });
            }
          });
          if (matches.length > 0) {
            matchingOldMessagesString = `\n## Older Relevant Discussion Excerpts (Retrieved via Keyword Search for "${userMessage}"):\n${matches.join("\n")}\n`;
          }
        }
      } catch (e) {
        console.error("[QAPipeline] Error searching old messages:", e);
      }
    }
    
    // Prepare conversational history context prompt
    const prompt = `${systemInstruction}

${matchingOldMessagesString}

Active Context:
${historyContext}

User: ${userMessage}

Liya:`;

    // Initialize variables to hold final answer text and sources
    let answerText = "";
    let finalSources: string[] = [];

    // Check if optional external keys are present and we want modular snippets as fallback/addition
    const optionalSnippets = await fetchOptionalExternalSearchSnippets(userMessage);

    // If Google Search grounding is beneficial, we return the search spoken confirmation immediately
    if (benefitsFromSearch) {
      console.log(`[QAPipeline] Query benefits from real-time grounding: "${userMessage}". Returning search confirmation directly.`);
      const { spokenConfirmation } = optimizeQueryAndDestination(userMessage);
      stats.webSearchUsed = true;
      stats.answerSource = "Local tools";
      dispatchTelemetry();
      return spokenConfirmation;
    } else {
      // General non-grounded query (Coding, reasoning, chat, creative)
      console.log(`[QAPipeline] Non-grounded query detected: "${userMessage}". Using internal knowledge directly.`);
      stats.geminiRequestsCount = 1;
      stats.whyGeminiCalled = reasoningCheck.reason;

      const response: any = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        })
      );

      answerText = response.text?.trim() || "I am reflecting on that.";
      stats.tokensUsed = response.usageMetadata?.totalTokenCount || Math.ceil((prompt.length + answerText.length) / 4);
      stats.answerSource = "Gemini internal knowledge";
    }

    // Save factual queries to local SQLite cache for instant re-use (Requirement 7)
    if (!reasoningCheck.needsReasoning && answerText) {
      mm.saveFactualQA(userMessage, answerText, stats.answerSource, finalSources);
    }

    dispatchTelemetry();
    return answerText;

  } catch (err: any) {
    console.error("[QAPipeline] QA Pipeline crashed:", err);
    
    // Check if it's a 429 rate limit or resource exhaustion error
    const is429 = String(err.message).includes("429") || 
                  String(err.message).toLowerCase().includes("exhausted") || 
                  String(err.status).includes("429");
                  
    if (is429) {
      stats.whyGeminiCalled = "Failed (Rate Limited / 429)";
      dispatchTelemetry();
      return "I'm sorry, but the AI service is temporarily rate limited (429 Resource Exhausted) due to high demand. Please try again in a few moments!";
    }

    dispatchTelemetry();
    return `I encountered an unexpected issue processing your request: ${err.message || err}`;
  }
}
