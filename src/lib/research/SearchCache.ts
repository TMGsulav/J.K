export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  sourceType?: string;
  publishDate?: string;
}

export interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  query: string;
  freshness?: string;
  ttl: number; // variable TTL
}

export interface PageCacheEntry {
  url: string;
  content: string;
  timestamp: number;
  ttl: number; // variable TTL
}

export interface AnswerCacheEntry {
  answer: string;
  sources: any[];
  pagesRead: any[];
  timestamp: number;
  query: string;
  ttl: number; // variable TTL
}

/**
 * Calculates custom TTL (in milliseconds) based on query keywords and url domain.
 */
export function getCustomTTL(query: string, url?: string): number {
  const q = query.toLowerCase().trim();

  // 1. Weather: 15 minutes
  if (/\b(weather|temperature|forecast|rain|snow|wind|humidity|climate|degrees|celsius|fahrenheit)\b/i.test(q)) {
    return 15 * 60 * 1000;
  }

  // 2. News / Sports Scores / Financial Stocks / Crypto / Live Releases: 10 minutes
  if (/\b(news|headline|score|match|game|winner|crypto|bitcoin|btc|eth|sol|stock|market|price|rate|usd|eur|ai model|gpt-4o|gemini 1.5|claude 3.5|deepseek|release|yesterday|now|live)\b/i.test(q)) {
    return 10 * 60 * 1000;
  }

  // 3. Prime Ministers / Presidents / Politicians: 1 hour
  if (/\b(prime minister|president|chancellor|election|minister|governor|mayor|cabinet|government|parliament)\b/i.test(q)) {
    return 60 * 60 * 1000;
  }

  // 4. Wikipedia / History / Encyclopedia / Biography: 7 days
  if (
    (url && url.toLowerCase().includes("wikipedia.org")) ||
    /\b(wikipedia|wiki|history|century|ancient|biography|born|died|emperor|king|war of|monument|timeline)\b/i.test(q)
  ) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  // 5. Programming Docs / Code / Technical / GitHub: 24 hours
  if (
    /\b(doc|docs|documentation|api|npm|pip|github|gitlab|typescript|javascript|python|rust|golang|react|vue|angular|express|drizzle|playwright|library|framework|css|html|tutorial|how to install|error|bug|code|function|class)\b/i.test(q)
  ) {
    return 24 * 60 * 60 * 1000;
  }

  // 6. Default Level 1 Stable facts / General other knowledge: 30 days
  return 30 * 24 * 60 * 60 * 1000;
}

export class SearchCache {
  private static instance: SearchCache;
  private cache = new Map<string, CacheEntry>();
  private pageCache = new Map<string, PageCacheEntry>();
  private answerCache = new Map<string, AnswerCacheEntry>();

  private constructor() {}

  public static getInstance(): SearchCache {
    if (!SearchCache.instance) {
      SearchCache.instance = new SearchCache();
    }
    return SearchCache.instance;
  }

  private normalizeKey(query: string, freshness?: string): string {
    return `${query.toLowerCase().trim()}_${freshness || "all"}`;
  }

  // --- Search Results Caching ---

  public get(query: string, freshness?: string): SearchResult[] | null {
    const key = this.normalizeKey(query, freshness);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      console.log(`[SearchCache] Cache Expired (TTL: ${entry.ttl}ms) for search query: "${query}"`);
      this.cache.delete(key);
      return null;
    }

    return entry.results;
  }

  public set(query: string, results: SearchResult[], freshness?: string): void {
    const key = this.normalizeKey(query, freshness);
    const ttl = getCustomTTL(query);
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      query,
      freshness,
      ttl
    });
    console.log(`[SearchCache] Cached search results for query: "${query}" (TTL: ${ttl / 1000 / 60} minutes)`);
  }

  // --- Web Page Content Caching ---

  public getPage(url: string): string | null {
    const entry = this.pageCache.get(url);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      console.log(`[SearchCache] Cache Expired (TTL: ${entry.ttl}ms) for webpage: ${url}`);
      this.pageCache.delete(url);
      return null;
    }

    return entry.content;
  }

  public setPage(url: string, content: string, queryContext: string = ""): void {
    const ttl = getCustomTTL(queryContext, url);
    this.pageCache.set(url, {
      url,
      content,
      timestamp: Date.now(),
      ttl
    });
    console.log(`[SearchCache] Cached webpage: ${url} (TTL: ${ttl / 1000 / 60} minutes)`);
  }

  // --- Synthesized Answers Caching ---

  public getAnswer(query: string): { answer: string; sources: any[]; pagesRead: any[] } | null {
    const key = query.toLowerCase().trim();
    const entry = this.answerCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      console.log(`[SearchCache] Cache Expired (TTL: ${entry.ttl}ms) for synthesized answer: "${query}"`);
      this.answerCache.delete(key);
      return null;
    }

    return {
      answer: entry.answer,
      sources: entry.sources,
      pagesRead: entry.pagesRead
    };
  }

  public setAnswer(query: string, answer: string, sources: any[], pagesRead: any[]): void {
    const key = query.toLowerCase().trim();
    const ttl = getCustomTTL(query);
    this.answerCache.set(key, {
      answer,
      sources,
      pagesRead,
      timestamp: Date.now(),
      query,
      ttl
    });
    console.log(`[SearchCache] Cached synthesized answer for query: "${query}" (TTL: ${ttl / 1000 / 60} minutes)`);
  }

  // --- General Maintenance ---

  public clear(): void {
    this.cache.clear();
    this.pageCache.clear();
    this.answerCache.clear();
  }

  public getStats() {
    return {
      searchEntries: this.cache.size,
      pageEntries: this.pageCache.size,
      answerEntries: this.answerCache.size
    };
  }
}
