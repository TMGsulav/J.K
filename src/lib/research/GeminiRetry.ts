import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Cache for Gemini requests
interface CacheEntry {
  response: any;
  timestamp: number;
}

class GeminiCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl = 5 * 60 * 1000; // 5 minutes TTL by default

  public get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultTtl) {
      this.cache.delete(key);
      return null;
    }
    return entry.response;
  }

  public set(key: string, response: any): void {
    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public getStats() {
    return {
      size: this.cache.size
    };
  }
}

const geminiCache = new GeminiCache();

// Quota Monitor & Rate Limiter tracker
interface RequestLog {
  timestamp: number;
  tokens: number;
}

class RateLimiter {
  private requestLogs: RequestLog[] = [];
  private dailyRequestCount = 0;
  private lastResetDate = new Date().toDateString();

  // Quota configuration
  public readonly RPM_LIMIT = 15;
  public readonly TPM_LIMIT = 35000;
  public readonly DAILY_LIMIT = 1500;

  public count429 = 0;
  public retryCount = 0;
  public cacheHits = 0;

  constructor() {
    this.checkDailyReset();
  }

  private checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailyRequestCount = 0;
      this.lastResetDate = today;
    }
  }

  public trackRequest(estimatedTokens: number) {
    this.checkDailyReset();
    const now = Date.now();
    this.requestLogs.push({ timestamp: now, tokens: estimatedTokens });
    this.dailyRequestCount++;
  }

  public track429() {
    this.count429++;
  }

  public trackRetry() {
    this.retryCount++;
  }

  public trackCacheHit() {
    this.cacheHits++;
  }

  private cleanLogs() {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestLogs = this.requestLogs.filter(log => log.timestamp >= oneMinuteAgo);
  }

  public getCurrentRPM(): number {
    this.cleanLogs();
    return this.requestLogs.length;
  }

  public getCurrentTPM(): number {
    this.cleanLogs();
    return this.requestLogs.reduce((acc, log) => acc + log.tokens, 0);
  }

  public getDailyRequests(): number {
    this.checkDailyReset();
    return this.dailyRequestCount;
  }

  public getRemainingQuotaEstimate(): number {
    this.checkDailyReset();
    return Math.max(0, this.DAILY_LIMIT - this.dailyRequestCount);
  }

  /**
   * Returns true if quota is nearing limits and low priority jobs should pause
   */
  public isQuotaLimited(): boolean {
    const rpm = this.getCurrentRPM();
    const tpm = this.getCurrentTPM();
    const dailyUsed = this.getDailyRequests();

    return (
      rpm >= this.RPM_LIMIT - 3 ||
      tpm >= this.TPM_LIMIT - 5000 ||
      dailyUsed >= this.DAILY_LIMIT - 50
    );
  }

  /**
   * Blocks execution if limits are about to be exceeded
   */
  public async enforceLimits(priority: "high" | "medium" | "low"): Promise<void> {
    this.checkDailyReset();
    this.cleanLogs();

    // 1. Enforce Daily Limit
    if (this.dailyRequestCount >= this.DAILY_LIMIT) {
      throw new Error(`Daily Gemini API quota of ${this.DAILY_LIMIT} requests has been exhausted.`);
    }

    // 2. Priority-based self-throttling / pauses
    if (priority === "low" && this.isQuotaLimited()) {
      console.log("[RateLimiter] Quota is limited. Pausing low priority background task...");
      while (this.isQuotaLimited()) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        this.cleanLogs();
      }
      console.log("[RateLimiter] Quota recovered. Resuming low priority background task.");
    }

    // 3. Enforce RPM & TPM limits with sliding window delay
    let rpm = this.getCurrentRPM();
    let tpm = this.getCurrentTPM();

    while (rpm >= this.RPM_LIMIT || tpm >= this.TPM_LIMIT) {
      console.warn(`[RateLimiter] Rate limit warning: RPM=${rpm}/${this.RPM_LIMIT}, TPM=${tpm}/${this.TPM_LIMIT}. Pausing queue execution briefly...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.cleanLogs();
      rpm = this.getCurrentRPM();
      tpm = this.getCurrentTPM();
    }
  }

  public getStats() {
    return {
      requestsToday: this.getDailyRequests(),
      currentRPM: this.getCurrentRPM(),
      currentTPM: this.getCurrentTPM(),
      remainingQuotaEstimate: this.getRemainingQuotaEstimate(),
      count429: this.count429,
      retryCount: this.retryCount,
      cacheHits: this.cacheHits,
      isQuotaLimited: this.isQuotaLimited()
    };
  }
}

const rateLimiter = new RateLimiter();

// Centralized Request Queue
class GeminiRequestQueue {
  private queue: { task: () => Promise<any>; priority: "high" | "medium" | "low" }[] = [];
  private running = 0;
  private readonly maxConcurrency = 2; // Maximum concurrent requests: 2
  private lastRequestTime = 0;
  private minSpacingMs = 1000; // Minimum 1 second between request starts to avoid rate spiking

  public add<T>(task: () => Promise<T>, priority: "high" | "medium" | "low" = "high"): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          // calculate required spacing spacing out consecutive requests
          const now = Date.now();
          const timeSinceLast = now - this.lastRequestTime;
          if (timeSinceLast < this.minSpacingMs) {
            const delay = this.minSpacingMs - timeSinceLast;
            await new Promise(r => setTimeout(r, delay));
          }
          this.lastRequestTime = Date.now();

          // Wait until rate limits are satisfied
          await rateLimiter.enforceLimits(priority);

          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };

      // Push and sort queue by priority (high > medium > low)
      this.queue.push({ task: wrappedTask, priority });
      this.queue.sort((a, b) => {
        const priorities = { high: 3, medium: 2, low: 1 };
        return priorities[b.priority] - priorities[a.priority];
      });

      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }
    this.running++;
    const nextItem = this.queue.shift();
    if (nextItem) {
      try {
        await nextItem.task();
      } catch (e) {
        // Handled within the wrapped task promise
      } finally {
        this.running--;
        // Small delay before looking for the next task
        setTimeout(() => this.process(), 50);
      }
    } else {
      this.running--;
    }
  }
}

const globalQueue = new GeminiRequestQueue();

// Primary call entry point with caching, prioritization, queuing, and retrying
export async function callWithRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries = 5,
  initialDelay = 3000,
  options?: { priority?: "high" | "medium" | "low"; cacheKey?: string; ttlMs?: number }
): Promise<T> {
  const priority = options?.priority || "high";
  const cacheKey = options?.cacheKey;

  // Check cache first if a key is provided
  if (cacheKey) {
    const cached = geminiCache.get(cacheKey);
    if (cached) {
      console.log(`[GeminiCache] Cache hit for key: ${cacheKey.substring(0, 50)}...`);
      rateLimiter.trackCacheHit();
      return cached as T;
    }
  }

  const result = await globalQueue.add(() => executeCall(apiCall, maxRetries, initialDelay), priority);

  // Cache successful responses
  if (cacheKey && result) {
    geminiCache.set(cacheKey, result);
  }

  return result;
}

// Estimates token count of a request payload roughly to protect TPM limit
function estimateTokens(payload: any): number {
  try {
    const str = typeof payload === "string" ? payload : JSON.stringify(payload);
    return Math.ceil(str.length / 4);
  } catch {
    return 1000;
  }
}

async function executeCall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number,
  initialDelay: number
): Promise<T> {
  let attempt = 0;
  const estimatedInputTokens = 1500; // conservative default estimate

  while (true) {
    try {
      rateLimiter.trackRequest(estimatedInputTokens);
      const result = await apiCall();
      return result;
    } catch (error: any) {
      attempt++;
      const errorStr = String(error?.message || error || "");
      const errorJson = typeof error === "object" ? JSON.stringify(error) : "";

      const isRateLimit =
        error?.status === 429 ||
        error?.statusCode === 429 ||
        error?.status === "RESOURCE_EXHAUSTED" ||
        error?.status?.code === 429 ||
        error?.status?.message?.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("429") ||
        errorStr.includes("quota") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        errorJson.includes("429") ||
        errorJson.includes("quota") ||
        errorJson.includes("RESOURCE_EXHAUSTED");

      const isTransient =
        error?.status === 503 ||
        error?.statusCode === 503 ||
        error?.status === 504 ||
        error?.statusCode === 504 ||
        error?.status === 500 ||
        error?.statusCode === 500 ||
        error?.status === "UNAVAILABLE" ||
        error?.status?.code === 503 ||
        errorStr.includes("503") ||
        errorStr.includes("504") ||
        errorStr.includes("500") ||
        errorStr.includes("UNAVAILABLE") ||
        errorStr.includes("demand") ||
        errorStr.includes("temporary") ||
        errorStr.includes("overloaded") ||
        errorStr.includes("try again later") ||
        errorJson.includes("503") ||
        errorJson.includes("UNAVAILABLE") ||
        errorJson.includes("demand") ||
        errorJson.includes("temporary");

      const isRetryable = isRateLimit || isTransient;

      if (isRateLimit) {
        rateLimiter.track429();
      }

      if (isRetryable && attempt <= maxRetries) {
        rateLimiter.trackRetry();

        // Exponential backoff with random jitter
        let delay = initialDelay * Math.pow(2, attempt - 1);
        const jitter = 500 + Math.random() * 1000;
        delay = delay + jitter;

        const MAX_BACKOFF_MS = 60000;
        delay = Math.min(delay, MAX_BACKOFF_MS);

        // Check for suggested retry duration headers/messages
        const secondsMatch = errorStr.match(/retry in ([\d.]+)\s*s/i);
        if (secondsMatch && secondsMatch[1]) {
          const suggestedDelayMs = parseFloat(secondsMatch[1]) * 1000 + 1500;
          delay = Math.max(delay, suggestedDelayMs);
        }

        // Check Retry-After header if available
        if (error?.headers && error.headers["retry-after"]) {
          const retryAfterSec = parseFloat(error.headers["retry-after"]);
          if (!isNaN(retryAfterSec)) {
            delay = Math.max(delay, retryAfterSec * 1000 + 1000);
          }
        }

        console.warn(`[GeminiRetry] Transient error or rate limit hit on attempt ${attempt}/${maxRetries}. Error: ${errorStr.substring(0, 150)}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Exceeded retries, or non-retryable error. Return a mock friendly response instead of freezing
        if (isRateLimit) {
          console.error(`[GeminiRetry] Exhausted all ${maxRetries} retries for 429 RESOURCE_EXHAUSTED. Returning friendly fallback response.`);
          const friendlyText = "I'm experiencing a high volume of requests right now. Let me pause for a moment to catch my breath. Let's continue our conversation in a few seconds!";
          return {
            text: friendlyText,
            candidates: [{
              content: { parts: [{ text: friendlyText }] }
            }]
          } as any;
        }

        if (isTransient) {
          console.error(`[GeminiRetry] Exhausted all ${maxRetries} retries for transient error (${errorStr.substring(0, 100)}). Returning friendly fallback response.`);
          const friendlyText = "The AI service is currently experiencing extremely high demand. I was unable to complete this action after several attempts. Please try again in a moment, or try asking something simpler!";
          return {
            text: friendlyText,
            candidates: [{
              content: { parts: [{ text: friendlyText }] }
            }]
          } as any;
        }

        throw error;
      }
    }
  }
}

export function getQuotaStats() {
  return rateLimiter.getStats();
}

export function robustParseJSON<T = any>(raw: string): T {
  if (!raw) {
    throw new Error("Empty input string for JSON parsing");
  }

  let cleaned = raw.trim();

  // If the raw response is the friendly transient fallback text from callWithRetry, return an empty object/array to avoid crashes
  if (
    cleaned.includes("AI service is currently experiencing") ||
    cleaned.includes("experiencing a high volume of requests") ||
    cleaned.includes("unable to complete this action")
  ) {
    console.warn("[GeminiRetry] robustParseJSON detected friendly fallback text. Returning default empty structure.");
    return {} as any;
  }

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");

    let candidate = "";
    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      candidate = cleaned.slice(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      candidate = cleaned.slice(firstBracket, lastBracket + 1);
    }

    if (candidate) {
      try {
        return JSON.parse(candidate) as T;
      } catch (innerErr: any) {
        try {
          const cleanedCandidate = candidate
            .replace(/,\s*([\]}])/g, "$1")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(?:^|[^:])\/\/.*$/gm, "");
          return JSON.parse(cleanedCandidate) as T;
        } catch {
          throw new Error(`Failed to parse candidate JSON substring: ${innerErr.message}. Original error: ${err.message}`);
        }
      }
    }
    throw err;
  }
}
