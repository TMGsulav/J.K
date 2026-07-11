import { GoogleGenAI } from "@google/genai";
import { SearchCache, SearchResult } from "./SearchCache";
import { SourceVerifier, VerifiedSource } from "./SourceVerifier";
import { PageReader, PageContent } from "./PageReader";
import { CitationManager } from "./CitationManager";
import { Summarizer } from "./Summarizer";
import { BrowserResearchEngine } from "./BrowserResearchEngine";
import { KnowledgeRouter } from "./KnowledgeRouter";
import { resolveSearchResults } from "./UrlResolver";

export interface ResearchReport {
  success: boolean;
  userMessage: string;
  optimizedQuery: string;
  freshness: string;
  sources: VerifiedSource[];
  pagesRead: PageContent[];
  finalResponse: string;
  isSimulatedFallback: boolean;
  error?: string;
}

export class SearchManager {
  private static instance: SearchManager;
  private cache = SearchCache.getInstance();
  private pageReader = new PageReader();

  private constructor() {}

  public static getInstance(): SearchManager {
    if (!SearchManager.instance) {
      SearchManager.instance = new SearchManager();
    }
    return SearchManager.instance;
  }

  /**
   * Performs real-time multi-step research on a given query/user request.
   */
  public async research(
    userMessage: string,
    getAI: () => GoogleGenAI | null
  ): Promise<ResearchReport> {
    console.log(`[SearchManager] Initiating True Real-Time Research Pipeline for: "${userMessage}"`);

    // Check Answer Cache first (Level 1, 2, or 3 cached final reports)
    // Satisfies Stable facts: <300ms, Cached live answers: <500ms
    const cachedAnswer = this.cache.getAnswer(userMessage);
    if (cachedAnswer) {
      console.log(`[SearchManager] Answer Cache Hit for query: "${userMessage}"`);
      return {
        success: true,
        userMessage,
        optimizedQuery: userMessage,
        freshness: "all",
        sources: cachedAnswer.sources,
        pagesRead: cachedAnswer.pagesRead,
        finalResponse: cachedAnswer.answer,
        isSimulatedFallback: false
      };
    }

    // Step 1: Intent & Knowledge Classifier
    const route = await KnowledgeRouter.classify(userMessage, getAI);
    console.log(`[SearchManager] Router classified query as Level ${route.level} (Reason: ${route.reason})`);

    // Level 1 - Stable Knowledge
    // Bypasses web search and Playwright entirely. Uses Gemini's internal knowledge base or local cache.
    if (route.level === 1) {
      try {
        console.log(`[SearchManager] Level 1 Route. Query is stable static knowledge. Synthesizing directly...`);
        const citationManager = new CitationManager();
        const summarizer = new Summarizer(citationManager);
        const finalResponse = await summarizer.synthesize(
          userMessage,
          [], // No search sources
          [], // No pages read
          getAI
        );

        // Cache the stable knowledge synthesized answer
        this.cache.setAnswer(userMessage, finalResponse, [], []);

        return {
          success: true,
          userMessage,
          optimizedQuery: route.primaryQuery,
          freshness: route.freshness,
          sources: [],
          pagesRead: [],
          finalResponse,
          isSimulatedFallback: false
        };
      } catch (err: any) {
        console.error("[SearchManager] Level 1 stable synthesis failed, returning fallback:", err);
        return {
          success: false,
          userMessage,
          optimizedQuery: route.primaryQuery,
          freshness: route.freshness,
          sources: [],
          pagesRead: [],
          finalResponse: "",
          isSimulatedFallback: false,
          error: err.message || "Stable knowledge synthesis failed."
        };
      }
    }

    // Level 2 & 3: Dynamic Knowledge or Deep Research (requires search results)
    const allSources: SearchResult[] = [];
    let isSimulatedFallback = false;

    // Check search cache for the optimized primary query
    const cachedResults = this.cache.get(route.primaryQuery, route.freshness);
    if (cachedResults && cachedResults.length > 0) {
      console.log(`[SearchManager] Search Cache Hit for primary query: "${route.primaryQuery}"`);
      allSources.push(...cachedResults);
    } else {
      // Execute parallel search across subqueries and merge results
      const searchPromises = route.subQueries.map(q => this.fetchFromProviders(q, route.freshness, getAI));
      const searchResultsArray = await Promise.all(searchPromises);

      // Merge and deduplicate by URL
      const uniqueUrls = new Set<string>();
      for (const resList of searchResultsArray) {
        for (const res of resList) {
          if (!uniqueUrls.has(res.url)) {
            uniqueUrls.add(res.url);
            allSources.push(res);
          }
        }
      }
    }

    // If we got real search results, save them to cache
    if (allSources.length > 0) {
      this.cache.set(route.primaryQuery, allSources, route.freshness);
    }

    // If all search sources failed (due to CAPTCHAs, timeouts, or API rate limits),
    // fall back to answering using internal knowledge rather than failing completely.
    if (allSources.length === 0) {
      console.warn("[SearchManager] All search providers failed to return results. Falling back to internal knowledge synthesis to provide a response.");
      try {
        const citationManager = new CitationManager();
        const summarizer = new Summarizer(citationManager);
        const finalResponse = await summarizer.synthesize(
          userMessage,
          [],
          [],
          getAI
        );

        // Cache this fallback answer
        this.cache.setAnswer(userMessage, finalResponse, [], []);

        return {
          success: true,
          userMessage,
          optimizedQuery: route.primaryQuery,
          freshness: route.freshness,
          sources: [],
          pagesRead: [],
          finalResponse,
          isSimulatedFallback: true
        };
      } catch (err: any) {
        console.error("[SearchManager] Fallback internal synthesis failed:", err);
        return {
          success: false,
          userMessage,
          optimizedQuery: route.primaryQuery,
          freshness: route.freshness,
          sources: [],
          pagesRead: [],
          finalResponse: "I couldn't access live web information right now, and my internal synthesizer failed.",
          isSimulatedFallback: false,
          error: err.message || "All search providers failed and fallback synthesis failed."
        };
      }
    }

    // Source Verification & Trust Ranking
    const verifiedSources = SourceVerifier.verifyAndSort(allSources);
    console.log(`[SearchManager] Source Verifier processed ${verifiedSources.length} sources.`);

    let pagesRead: PageContent[] = [];

    // Level 2 vs Level 3 Routing for Reading Webpages
    if (route.level === 3) {
      // Level 3 - Deep Research: Launch Playwright to read top trusted pages in depth
      const topTrustedPages = verifiedSources
        .filter(s => s.sourceCategory !== "forum") // avoid reading forum pages in depth, keep to snippets
        .slice(0, 3); // Read top 3 pages in depth

      if (topTrustedPages.length > 0) {
        console.log(`[SearchManager] Level 3 Deep Research. Reading top ${topTrustedPages.length} trusted pages using Playwright:`, topTrustedPages.map(p => p.url));
        const readPromises = topTrustedPages.map(async p => {
          try {
            const res = await BrowserResearchEngine.getInstance().readWebpage(p.url, p.title);
            return {
              url: res.url,
              title: res.title,
              content: res.content,
              success: res.success
            };
          } catch (err: any) {
            return {
              url: p.url,
              title: p.title,
              content: `Failed: ${err.message}`,
              success: false,
              error: err.message
            };
          }
        });
        pagesRead = await Promise.all(readPromises);
      }
    } else {
      // Level 2 - Dynamic Knowledge: Browser is NOT launched. No Playwright pages read.
      // Synthesizes response immediately using Google Search result snippets to be ultra fast (2-5s goal)
      console.log(`[SearchManager] Level 2 Route. Dynamic information requested. Synthesizing directly from search snippets to bypass Playwright launches.`);
    }

    // Step 5: Summarize and Synthesize with citations
    const citationManager = new CitationManager();
    const summarizer = new Summarizer(citationManager);

    try {
      console.log(`[SearchManager] Summarizing and synthesizing final response with citations...`);
      const finalResponse = await summarizer.synthesize(
        userMessage,
        verifiedSources.slice(0, 8), // Keep top 8 sources for reference
        pagesRead,
        getAI
      );

      // Cache the final response so future requests can hit Cached live answers <500ms
      this.cache.setAnswer(userMessage, finalResponse, verifiedSources, pagesRead);

      return {
        success: true,
        userMessage,
        optimizedQuery: route.primaryQuery,
        freshness: route.freshness,
        sources: verifiedSources,
        pagesRead,
        finalResponse,
        isSimulatedFallback
      };
    } catch (e: any) {
      console.error("[SearchManager] Summarizer synthesis failed:", e);
      return {
        success: false,
        userMessage,
        optimizedQuery: route.primaryQuery,
        freshness: route.freshness,
        sources: verifiedSources,
        pagesRead,
        finalResponse: "",
        isSimulatedFallback,
        error: e.message || "Failed during final synthesis step"
      };
    }
  }

  /**
   * Dispatches the query to Playwright browser search, fallback to API keys/DuckDuckGo if needed.
   */
  private async fetchFromProviders(
    query: string,
    freshness: string,
    getAI: () => GoogleGenAI | null
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Primary Autonomous Web Search: Search Google/Bing directly using Playwright browser engine
    try {
      console.log(`[SearchManager] Executing Playwright-powered autonomous web search for: "${query}"`);
      const browserResults = await BrowserResearchEngine.getInstance().searchWeb(query, "google");
      if (browserResults && browserResults.length > 0) {
        console.log(`[SearchManager] Playwright search returned ${browserResults.length} organic results.`);
        results.push(...browserResults);
        return results;
      }
    } catch (browserErr: any) {
      console.error("[SearchManager] Playwright autonomous search failed, trying fallback search API keys...", browserErr);
    }

    const tavilyKey = process.env.TAVILY_API_KEY;
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    const serperKey = process.env.SERPER_API_KEY;

    // Create parallel fetch array for active keys
    const fetchPromises: Array<Promise<SearchResult[]>> = [];

    if (tavilyKey) {
      fetchPromises.push(this.fetchTavily(query, tavilyKey, freshness));
    }
    if (braveKey) {
      fetchPromises.push(this.fetchBrave(query, braveKey, freshness));
    }
    if (serperKey) {
      fetchPromises.push(this.fetchSerper(query, serperKey, freshness));
    }

    // Execute active API providers in parallel
    if (fetchPromises.length > 0) {
      try {
        const promiseResults = await Promise.all(fetchPromises);
        for (const list of promiseResults) {
          results.push(...list);
        }
      } catch (e) {
        console.error("[SearchManager] Error in parallel provider fetch:", e);
      }
    }

    // Fallback Step 1: If no results fetched or no APIs configured, run Gemini Search Grounding
    if (results.length === 0) {
      console.log(`[SearchManager] No API results. Trying Gemini Search Grounding fallback for: "${query}"`);
      const geminiResults = await this.fetchGeminiSearch(query, getAI);
      if (geminiResults && geminiResults.length > 0) {
        results.push(...geminiResults);
      }
    }

    // Fallback Step 2: If Gemini Search Grounding fails or returns nothing, run DuckDuckGo Instant Answer + DDG web search
    if (results.length === 0) {
      console.log(`[SearchManager] No Gemini search results. Running DuckDuckGo Instant Answer fallback for: "${query}"`);
      const ddgResults = await this.fetchDuckDuckGo(query);
      results.push(...ddgResults);
    }

    return results;
  }

  private async fetchTavily(query: string, apiKey: string, freshness: string): Promise<SearchResult[]> {
    console.log(`[SearchManager] Querying Tavily API for: "${query}"`);
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          max_results: 5,
          search_depth: "basic",
          time_range: freshness === "live" ? "day" : freshness === "24h" ? "day" : freshness === "7d" ? "week" : freshness === "30d" ? "month" : undefined
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        if (data.results && Array.isArray(data.results)) {
          return data.results.map((item: any) => ({
            title: item.title || "Tavily Web Search Result",
            snippet: item.content || item.snippet || "",
            url: item.url || ""
          }));
        }
      }
    } catch (e: any) {
      console.error("[SearchManager] Tavily API error:", e.message);
    }
    return [];
  }

  private async fetchBrave(query: string, apiKey: string, freshness: string): Promise<SearchResult[]> {
    console.log(`[SearchManager] Querying Brave Search API for: "${query}"`);
    try {
      // Setup time filter
      let timeFilter = "";
      if (freshness === "live" || freshness === "24h") timeFilter = "&count=5&freshness=pd";
      else if (freshness === "7d") timeFilter = "&count=5&freshness=pw";
      else if (freshness === "30d") timeFilter = "&count=5&freshness=pm";

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}${timeFilter}`, {
        headers: { "X-Subscription-Token": apiKey }
      });

      if (response.ok) {
        const data: any = await response.json();
        const webResults = data.web?.results;
        if (Array.isArray(webResults)) {
          return webResults.map((item: any) => ({
            title: item.title || "Brave Search Result",
            snippet: item.description || "",
            url: item.url || ""
          }));
        }
      }
    } catch (e: any) {
      console.error("[SearchManager] Brave Search API error:", e.message);
    }
    return [];
  }

  private async fetchSerper(query: string, apiKey: string, freshness: string): Promise<SearchResult[]> {
    console.log(`[SearchManager] Querying Serper Search API for: "${query}"`);
    try {
      const payload: any = { q: query, num: 5 };
      if (freshness === "live" || freshness === "24h") payload.tbs = "qdr:d";
      else if (freshness === "7d") payload.tbs = "qdr:w";
      else if (freshness === "30d") payload.tbs = "qdr:m";

      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data: any = await response.json();
        const organicResults = data.organic;
        if (Array.isArray(organicResults)) {
          return organicResults.map((item: any) => ({
            title: item.title || "Serper Google Search Result",
            snippet: item.snippet || "",
            url: item.link || item.url || ""
          }));
        }
      }
    } catch (e: any) {
      console.error("[SearchManager] Serper API error:", e.message);
    }
    return [];
  }

  private async fetchGeminiSearch(query: string, getAI: () => GoogleGenAI | null): Promise<SearchResult[]> {
    const ai = getAI();
    if (!ai) return [];

    console.log(`[SearchManager] Querying Gemini Search Grounding for: "${query}"`);
    try {
      const { callWithRetry } = await import("./GeminiRetry");
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Search Google for current information on: "${query}". Provide a highly brief summary.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        })
      );

      const results: SearchResult[] = [];
      const metadata = response.candidates?.[0]?.groundingMetadata;
      if (metadata) {
        const chunks = metadata.groundingChunks;
        const supports = metadata.groundingSupports;

        if (Array.isArray(chunks)) {
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.web) {
              const url = chunk.web.uri;
              const title = chunk.web.title;

              // Try to find a snippet from groundingSupports matching this chunk index
              let snippet = "";
              if (Array.isArray(supports)) {
                const matchingSupport = supports.find(s => 
                  Array.isArray(s.groundingChunkIndices) && s.groundingChunkIndices.includes(i)
                );
                if (matchingSupport && matchingSupport.segment) {
                  snippet = matchingSupport.segment.text;
                }
              }

              if (!snippet) {
                snippet = `Google Search Grounding result for: ${query}`;
              }

              results.push({
                title: title || "Google Search Result",
                url: url,
                snippet: snippet
              });
            }
          }
        }
      }

      console.log(`[SearchManager] Gemini Search Grounding returned ${results.length} results.`);
      return results;
    } catch (e: any) {
      console.error("[SearchManager] Gemini Search Grounding failed:", e.message);
    }
    return [];
  }

  private async fetchDuckDuckGo(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 1. Try DuckDuckGo HTML scraping first
    try {
      console.log(`[SearchManager] Attempting DuckDuckGo HTML scraping for: "${query}"`);
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      });

      if (response.ok) {
        const html = await response.text();
        const resultBlocks = html.split('class="result results_links results_links_deep web-result');
        
        for (let i = 1; i < resultBlocks.length; i++) {
          const block = resultBlocks[i];
          
          const aMatch = block.match(/<a\s+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
          if (!aMatch) continue;

          let rawUrl = aMatch[1];
          let title = aMatch[2].replace(/<[^>]+>/g, "").trim();

          let decodedUrl = rawUrl;
          if (rawUrl.includes("uddg=")) {
            const uddgIndex = rawUrl.indexOf("uddg=");
            const uddgEnd = rawUrl.indexOf("&", uddgIndex);
            const encodedUrl = uddgEnd === -1 
              ? rawUrl.substring(uddgIndex + 5) 
              : rawUrl.substring(uddgIndex + 5, uddgEnd);
            try {
              decodedUrl = decodeURIComponent(encodedUrl);
            } catch (e) {
              decodedUrl = rawUrl;
            }
          } else if (rawUrl.startsWith("//")) {
            decodedUrl = "https:" + rawUrl;
          }

          const snippetMatch = block.match(/<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || 
                               block.match(/<div\s+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/) ||
                               block.match(/<span\s+class="result__snippet"[^>]*>([\s\S]*?)<\/span>/);
          
          let snippet = "";
          if (snippetMatch) {
            snippet = snippetMatch[1].replace(/<[^>]+>/g, "").trim();
          }

          if (title && decodedUrl) {
            results.push({
              title,
              snippet: snippet || title,
              url: decodedUrl
            });
          }
        }

        if (results.length > 0) {
          console.log(`[SearchManager] DuckDuckGo HTML scraping succeeded with ${results.length} results.`);
          return results;
        }
      }
    } catch (scrapeErr: any) {
      console.warn("[SearchManager] DuckDuckGo HTML scraping failed:", scrapeErr.message);
    }

    // 2. Fall back to Official DuckDuckGo Instant Answer API
    try {
      console.log(`[SearchManager] Falling back to DDG Instant Answer API for: "${query}"`);
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`);
      if (response.ok) {
        const data: any = await response.json();

        if (data.AbstractText) {
          results.push({
            title: data.Heading || `${query} (DDG Abstract)`,
            snippet: data.AbstractText,
            url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
          });
        }

        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 4)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 40),
                snippet: topic.Text,
                url: topic.FirstURL
              });
            }
          }
        }
      }
    } catch (apiErr: any) {
      console.error("[SearchManager] DuckDuckGo API fallback failed:", apiErr.message);
    }

    return results;
  }
}
