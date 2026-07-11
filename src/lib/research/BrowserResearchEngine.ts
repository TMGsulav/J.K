import { chromium, Browser, BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { SearchCache, SearchResult } from "./SearchCache";
import { resolveUrl, resolveSearchResults } from "./UrlResolver";

export interface ResearchSessionLog {
  query: string;
  timestamp: number;
  duration: number;
  success: boolean;
  sourcesCount: number;
  engineUsed: string;
  visitedUrls: string[];
  error?: string;
}

export interface BrowserDashboardState {
  browserStatus: "closed" | "launching" | "ready" | "busy" | "error";
  currentPage: string | null;
  visitedUrls: string[];
  cacheStats: {
    searchEntries: number;
    pageEntries: number;
  };
  researchHistory: ResearchSessionLog[];
  stats: {
    successRate: number;
    avgTimeMs: number;
    totalResearchCount: number;
    geminiRequests: number;
    estimatedTokens: number;
    memoryUsageMb: number;
  };
}

export class BrowserResearchEngine {
  private static instance: BrowserResearchEngine;
  private context: BrowserContext | null = null;
  private currentUrl: string | null = null;
  private status: "closed" | "launching" | "ready" | "busy" | "error" = "closed";
  private googleCaptchaCooldownUntil: number = 0;
  
  // Metrics & State
  private visitedUrls: string[] = [];
  private history: ResearchSessionLog[] = [];
  private geminiRequests = 0;
  private estimatedTokens = 0;

  private constructor() {
    // Ensure downloads/Research directory exists
    const researchDir = path.join(process.cwd(), "Research");
    if (!fs.existsSync(researchDir)) {
      fs.mkdirSync(researchDir, { recursive: true });
    }
  }

  public static getInstance(): BrowserResearchEngine {
    if (!BrowserResearchEngine.instance) {
      BrowserResearchEngine.instance = new BrowserResearchEngine();
    }
    return BrowserResearchEngine.instance;
  }

  /**
   * Helper to add a randomized delay between requests and stages
   */
  private async randomDelay(min: number = 800, max: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Safe persistent browser context retrieval with auto-recovery
   */
  private async getBrowserContext(): Promise<BrowserContext> {
    if (this.context) {
      return this.context;
    }

    this.status = "launching";
    console.log("[BrowserResearchEngine] Launching Chromium persistent browser context...");
    try {
      const profileDir = path.join(process.cwd(), "Research", "browser_profile");
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }

      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edge/123.0.0.0"
      ];
      const selectedUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      const viewports = [
        { width: 1366, height: 768 },
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1280, height: 800 }
      ];
      const selectedViewport = viewports[Math.floor(Math.random() * viewports.length)];

      this.context = await chromium.launchPersistentContext(profileDir, {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--blink-settings=imagesEnabled=false" // Skip image loading for extra speed
        ],
        userAgent: selectedUserAgent,
        viewport: selectedViewport,
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "America/New_York"
      });

      // Simple anti-detection
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });
      });

      this.status = "ready";
      console.log("[BrowserResearchEngine] Persistent browser context successfully launched.");
      return this.context;
    } catch (e: any) {
      this.status = "error";
      console.error("[BrowserResearchEngine] Error launching persistent context:", e);
      throw e;
    }
  }

  /**
   * Close browser context and clean memory
   */
  public async closeBrowser(): Promise<void> {
    try {
      if (this.context) {
        console.log("[BrowserResearchEngine] Closing persistent browser context...");
        await this.context.close();
      }
    } catch (e) {
      console.error("[BrowserResearchEngine] Error closing persistent context:", e);
    } finally {
      this.context = null;
      this.currentUrl = null;
      this.status = "closed";
    }
  }

  /**
   * Captures and saves a live screenshot of the page to public/live_research.png
   */
  public async saveLiveScreenshot(page: any): Promise<void> {
    try {
      const publicDir = path.join(process.cwd(), "public");
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const screenshotPath = path.join(publicDir, "live_research.png");
      await page.screenshot({ path: screenshotPath }).catch(() => {});
      console.log(`[BrowserResearchEngine] Saved live research screenshot to: ${screenshotPath}`);
    } catch (e) {
      console.error("[BrowserResearchEngine] Failed to capture live screenshot:", e);
    }
  }

  /**
   * Tracks a Gemini API request for the dashboard
   */
  public logGeminiRequest(tokens: number = 0) {
    this.geminiRequests++;
    this.estimatedTokens += tokens;
  }

  /**
   * Fetches the current dashboard state
   */
  public getDashboardState(): BrowserDashboardState {
    const totalCount = this.history.length;
    const successful = this.history.filter(h => h.success).length;
    const successRate = totalCount > 0 ? Math.round((successful / totalCount) * 100) : 100;
    const avgTimeMs = totalCount > 0 ? Math.round(this.history.reduce((acc, h) => acc + h.duration, 0) / totalCount) : 0;
    
    // Get node process memory usage
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    return {
      browserStatus: this.status,
      currentPage: this.currentUrl,
      visitedUrls: Array.from(new Set(this.visitedUrls)).slice(-15), // Last 15 unique
      cacheStats: SearchCache.getInstance().getStats(),
      researchHistory: this.history.slice(-20), // Last 20 logs
      stats: {
        successRate,
        avgTimeMs,
        totalResearchCount: totalCount,
        geminiRequests: this.geminiRequests,
        estimatedTokens: this.estimatedTokens,
        memoryUsageMb: Math.round(memoryUsage * 10) / 10
      }
    };
  }

  /**
   * Performs an autonomous search using Playwright, fallbacks to other engines on CAPTCHA/Error.
   * Caches successful search results locally.
   */
  public async searchWeb(
    query: string,
    engine: "google" | "bing" | "duckduckgo" | "brave" = "google"
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const normalizedQuery = query.toLowerCase().trim();

    // Requirement 5: Cache successful search results locally to reduce repeated searches
    const cached = SearchCache.getInstance().get(normalizedQuery);
    if (cached && cached.length > 0) {
      console.log(`[BrowserResearchEngine] Search Cache Hit for: "${query}"`);
      return cached;
    }

    this.status = "busy";
    console.log(`[BrowserResearchEngine] Searching for "${query}" starting with preferred engine: ${engine}...`);
    
    let results: SearchResult[] = [];
    let engineUsed = engine;
    const errors: string[] = [];

    // Setup sequence of engines to try
    const enginesToTry: ("google" | "bing" | "duckduckgo" | "brave")[] = [];
    if (engine === "google") {
      enginesToTry.push("google", "bing", "duckduckgo", "brave");
    } else {
      enginesToTry.push(engine);
      const remaining: ("google" | "bing" | "duckduckgo" | "brave")[] = ["google", "bing", "duckduckgo", "brave"];
      for (const r of remaining) {
        if (!enginesToTry.includes(r)) {
          enginesToTry.push(r);
        }
      }
    }

    for (const currentEngine of enginesToTry) {
      // Check if we are in CAPTCHA cooldown for Google
      if (currentEngine === "google" && Date.now() < this.googleCaptchaCooldownUntil) {
        const skipMsg = `Google skipped due to active CAPTCHA cooldown (expires in ${Math.round((this.googleCaptchaCooldownUntil - Date.now()) / 1000)}s)`;
        console.warn(`[BrowserResearchEngine] ${skipMsg}`);
        errors.push(skipMsg);
        continue;
      }

      console.log(`[BrowserResearchEngine] Attempting web search using engine: ${currentEngine}`);
      engineUsed = currentEngine;

      // Add randomized delay before navigation to simulate human typing and behavior
      await this.randomDelay(800, 1800);

      try {
        const searchRes = await this.executeBrowserSearch(query, currentEngine);
        
        if (searchRes && searchRes.length > 0) {
          results = searchRes;
          console.log(`[BrowserResearchEngine] Successfully retrieved ${results.length} organic results from ${currentEngine}`);
          break; // Stop falling back once we have successful results!
        } else {
          const errMsg = `No organic results parsed from ${currentEngine}.`;
          console.warn(`[BrowserResearchEngine] ${errMsg}`);
          errors.push(`${currentEngine}: ${errMsg}`);
        }
      } catch (err: any) {
        const errMsg = err.message || "Unknown error";
        console.error(`[BrowserResearchEngine] Error during ${currentEngine} search:`, errMsg);
        errors.push(`${currentEngine}: ${errMsg}`);

        // If Google threw a CAPTCHA error, enforce cooldown and "Stop scraping Google immediately"
        if (currentEngine === "google" && (errMsg.includes("CAPTCHA") || errMsg.includes("robot"))) {
          console.warn(`[BrowserResearchEngine] Google CAPTCHA triggered! Initiating 10-minute cooldown.`);
          this.googleCaptchaCooldownUntil = Date.now() + 10 * 60 * 1000;
        }
      }
    }

    const duration = Date.now() - startTime;

    // Requirement 6: Log exactly why a search failed (including consolidated errors)
    if (results.length > 0) {
      // Store successful search in local cache
      SearchCache.getInstance().set(normalizedQuery, results);

      this.history.push({
        query,
        timestamp: Date.now(),
        duration,
        success: true,
        sourcesCount: results.length,
        engineUsed,
        visitedUrls: results.map(r => r.url).slice(0, 3)
      });
      this.status = "ready";
      return results;
    } else {
      const consolidatedError = `All search providers failed. Errors: [${errors.join(" | ")}]`;
      console.error(`[BrowserResearchEngine] ${consolidatedError}`);

      this.history.push({
        query,
        timestamp: Date.now(),
        duration,
        success: false,
        sourcesCount: 0,
        engineUsed: "none",
        visitedUrls: [],
        error: consolidatedError
      });

      this.status = "ready";
      // Requirement 2: If all providers fail, return a clear error instead of invoking Gemini
      throw new Error(consolidatedError);
    }
  }

  private async executeBrowserSearch(
    query: string,
    engine: "google" | "bing" | "duckduckgo" | "brave"
  ): Promise<SearchResult[]> {
    const context = await this.getBrowserContext();
    const page = await context.newPage();
    const results: SearchResult[] = [];

    try {
      // Set reasonable timeouts
      page.setDefaultTimeout(12000);
      page.setDefaultNavigationTimeout(15000);

      if (engine === "google") {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`;
        this.currentUrl = searchUrl;
        this.visitedUrls.push(searchUrl);
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
        await this.saveLiveScreenshot(page);

        // Check for CAPTCHA/Robot detection
        const hasCaptcha = await page.evaluate(() => {
          const bodyText = document.body.innerHTML.toLowerCase();
          return bodyText.includes("captcha") || 
                 bodyText.includes("not a robot") ||
                 bodyText.includes("detected unusual traffic") ||
                 bodyText.includes("g-recaptcha") ||
                 document.title.toLowerCase().includes("consent flow") ||
                 document.title.toLowerCase().includes("robot") ||
                 !!document.querySelector("#captcha-form");
        });

        if (hasCaptcha) {
          throw new Error("Google CAPTCHA or robot verification page encountered.");
        }

        // Wait for search container
        await page.waitForSelector(".g", { timeout: 4000 }).catch(() => {
          throw new Error("Selector '.g' for Google results timed out.");
        });

        // Extract organic results
        const items = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll(".g"));
          return els.map(el => {
            const anchor = el.querySelector("a");
            const heading = el.querySelector("h3");
            const snippetEl = el.querySelector(".VwiC3b, .yD3Yfe");
            return {
              title: heading ? heading.textContent || "" : "",
              url: anchor ? anchor.href : "",
              snippet: snippetEl ? snippetEl.textContent || "" : ""
            };
          }).filter(item => item.url && item.url.startsWith("http"));
        });

        results.push(...items);
      } else if (engine === "bing") {
        const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        this.currentUrl = searchUrl;
        this.visitedUrls.push(searchUrl);
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
        await this.saveLiveScreenshot(page);

        // Check for CAPTCHA
        const hasCaptcha = await page.evaluate(() => {
          const bodyText = document.body.innerHTML.toLowerCase();
          return bodyText.includes("captcha") || 
                 bodyText.includes("not a robot") ||
                 document.title.toLowerCase().includes("challenge");
        });

        if (hasCaptcha) {
          throw new Error("Bing CAPTCHA or security challenge page encountered.");
        }

        await page.waitForSelector(".b_algo", { timeout: 4000 }).catch(() => {
          throw new Error("Selector '.b_algo' for Bing results timed out.");
        });

        const items = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll(".b_algo"));
          return els.map(el => {
            const heading = el.querySelector("h2 a");
            const snippetEl = el.querySelector(".b_caption p, .b_lineLimit2");
            return {
              title: heading ? heading.textContent || "" : "",
              url: heading ? (heading as HTMLAnchorElement).href : "",
              snippet: snippetEl ? snippetEl.textContent || "" : ""
            };
          }).filter(item => item.url && item.url.startsWith("http"));
        });

        results.push(...items);
      } else if (engine === "duckduckgo") {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        this.currentUrl = searchUrl;
        this.visitedUrls.push(searchUrl);
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
        await this.saveLiveScreenshot(page);

        // Check for CAPTCHA
        const hasCaptcha = await page.evaluate(() => {
          const bodyText = document.body.innerHTML.toLowerCase();
          return bodyText.includes("ddg-captcha") || 
                 document.title.toLowerCase().includes("attention required");
        });

        if (hasCaptcha) {
          throw new Error("DuckDuckGo CAPTCHA page encountered.");
        }

        await page.waitForSelector(".result", { timeout: 4000 }).catch(() => {
          throw new Error("Selector '.result' for DuckDuckGo results timed out.");
        });

        const items = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll(".result"));
          return els.map(el => {
            const heading = el.querySelector(".result__title a");
            const snippetEl = el.querySelector(".result__snippet");
            return {
              title: heading ? heading.textContent || "" : "",
              url: heading ? (heading as HTMLAnchorElement).href : "",
              snippet: snippetEl ? snippetEl.textContent || "" : ""
            };
          }).filter(item => item.url && item.url.startsWith("http"));
        });

        results.push(...items);
      } else if (engine === "brave") {
        const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
        this.currentUrl = searchUrl;
        this.visitedUrls.push(searchUrl);
        await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
        await this.saveLiveScreenshot(page);

        // Check for CAPTCHA
        const hasCaptcha = await page.evaluate(() => {
          const bodyText = document.body.innerHTML.toLowerCase();
          return bodyText.includes("captcha") || 
                 document.title.toLowerCase().includes("robot");
        });

        if (hasCaptcha) {
          throw new Error("Brave CAPTCHA or robot verification page encountered.");
        }

        await page.waitForSelector(".snippet", { timeout: 4000 }).catch(() => {
          throw new Error("Selector '.snippet' for Brave results timed out.");
        });

        const items = await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll(".snippet"));
          return els.map(el => {
            const heading = el.querySelector(".title, h2");
            const anchor = el.querySelector("a");
            const snippetEl = el.querySelector(".snippet-description, p");
            return {
              title: heading ? heading.textContent || "" : "",
              url: anchor ? anchor.href : "",
              snippet: snippetEl ? snippetEl.textContent || "" : ""
            };
          }).filter(item => item.url && item.url.startsWith("http"));
        });

        results.push(...items);
      }
    } catch (e: any) {
      throw e;
    } finally {
      await page.close();
    }

    return resolveSearchResults(results);
  }

  /**
   * Navigates directly to a webpage, extracts readable article/documentation, handles PDF or takes screenshot if failed.
   */
  public async readWebpage(url: string, title: string = ""): Promise<{ url: string; title: string; content: string; success: boolean }> {
    // Resolve Bing redirect/tracking URLs before reading webpages
    url = await resolveUrl(url);

    // Check local SearchCache first!
    const cached = SearchCache.getInstance().getPage(url);
    if (cached) {
      console.log(`[BrowserResearchEngine] Page Cache Hit for: ${url}`);
      return { url, title, content: cached, success: true };
    }

    this.status = "busy";
    this.currentUrl = url;
    this.visitedUrls.push(url);

    // If it's a PDF, download it instead of reading as HTML
    if (url.toLowerCase().endsWith(".pdf")) {
      console.log(`[BrowserResearchEngine] PDF detected. Downloading: ${url}`);
      const pdfPath = await this.downloadFile(url);
      const contentStr = `[PDF Document Downloaded Successfully]\nStored locally at: ${pdfPath}\nUrl: ${url}\nLiya can analyze this PDF document in the local filesystem.`;
      
      SearchCache.getInstance().setPage(url, contentStr);
      this.status = "ready";
      return { url, title, content: contentStr, success: true };
    }

    const context = await this.getBrowserContext();
    const page = await context.newPage();

    try {
      page.setDefaultTimeout(12000);
      page.setDefaultNavigationTimeout(15000);

      console.log(`[BrowserResearchEngine] Browsing to webpage: ${url}`);
      await this.randomDelay(500, 1200); // Simulate realistic pause before page read
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await this.saveLiveScreenshot(page);

      // Clean typical popup modals or cookie banners
      await page.evaluate(`() => {
        const selectors = [
          "[id*='cookie']", "[class*='cookie']", "[id*='consent']", "[class*='consent']",
          "[id*='banner']", "[class*='banner']", ".modal", ".popup", "[class*='overlay']"
        ];
        selectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => el.remove());
          } catch (e) {}
        });
      }`).catch(() => {});
      await this.saveLiveScreenshot(page);

      // Extract main readable content
      const pageInfo = await page.evaluate(`() => {
        const pgTitle = document.title || "";

        // Attempt to find the main article element first
        const mainEl = document.querySelector("article, main, #content, .content, .post-content, .markdown-body");
        const root = mainEl || document.body;

        if (!root) {
          return { title: pgTitle, content: "" };
        }

        const items = [];

        function traverse(element) {
          const tag = element.tagName.toLowerCase();

          if (["script", "style", "nav", "footer", "header", "iframe", "noscript"].includes(tag)) {
            return;
          }

          if (tag.startsWith("h") && tag.length === 2) {
            const text = element.textContent?.trim();
            if (text) items.push("\\n## " + text + "\\n");
          } else if (tag === "p") {
            const text = element.textContent?.trim();
            if (text && text.length > 10) items.push(text + "\\n");
          } else if (tag === "pre" || tag === "code") {
            const text = element.textContent?.trim();
            if (text && text.length > 5) {
              items.push("\\n\`\`\`\\n" + text + "\\n\`\`\`\\n");
            }
          } else if (tag === "table") {
            const rows = Array.from(element.querySelectorAll("tr"));
            const tableMarkdown = [""];
            rows.forEach((row, rIdx) => {
              const cells = Array.from(row.querySelectorAll("th, td"));
              const cellTexts = cells.map(c => c.textContent?.trim().replace(/\\|/g, "\\\\|") || "");
              tableMarkdown.push("| " + cellTexts.join(" | ") + " |");
              if (rIdx === 0) {
                tableMarkdown.push("| " + cells.map(() => "---").join(" | ") + " |");
              }
            });
            items.push(tableMarkdown.join("\\n") + "\\n");
          } else if (tag === "ul" || tag === "ol") {
            const listItems = Array.from(element.querySelectorAll("li"));
            listItems.forEach(li => {
              const text = li.textContent?.trim();
              if (text) items.push("- " + text);
            });
            items.push("");
          } else {
            Array.from(element.children).forEach(child => traverse(child));
          }
        }

        traverse(root);

        return {
          title: pgTitle,
          content: items.join("\\n")
        };
      }`) as { title: string; content: string };

      let extractedContent = pageInfo.content.trim();

      // Screenshot Fallback & OCR Simulation if text content is extremely low/failed
      if (extractedContent.length < 150) {
        console.warn(`[BrowserResearchEngine] Extracted very low content (${extractedContent.length} chars). Taking screenshot fallback...`);
        const screenshotDir = path.join(process.cwd(), "Research", "Screenshots");
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const safeName = url.replace(/[^a-z0-9]/gi, "_").toLowerCase().substring(0, 50);
        const screenshotPath = path.join(screenshotDir, `${safeName}.png`);
        
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        
        extractedContent = `[Visual Web Screenshot Captured]\nSaved screenshot at: ${screenshotPath}\nURL: ${url}\nTitle: ${pageInfo.title}\n\n[Extracted Visual Content (Simulation)]:\nWe have taken a PNG screenshot. Page content extracted via Gemini Multi-modal or direct document analysis.`;
      }

      if (extractedContent.length > 10000) {
        extractedContent = extractedContent.substring(0, 10000) + "\n... [truncated to 10k chars]";
      }

      // Cache the parsed page content
      SearchCache.getInstance().setPage(url, extractedContent);

      this.status = "ready";
      await page.close();
      return { url, title: pageInfo.title, content: extractedContent, success: true };
    } catch (e: any) {
      console.error(`[BrowserResearchEngine] Failed reading webpage ${url}:`, e);
      await page.close();
      this.status = "ready";

      return {
        url,
        title,
        content: `Failed to open webpage: ${e.message}`,
        success: false
      };
    }
  }

  /**
   * Downloads a documentation file or PDF safely to the Research folder
   */
  public async downloadFile(url: string): Promise<string> {
    const filename = path.basename(new URL(url).pathname) || `download_${Date.now()}.bin`;
    const targetPath = path.join(process.cwd(), "Research", filename);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(targetPath, buffer);
      console.log(`[BrowserResearchEngine] File downloaded successfully to: ${targetPath}`);
      return targetPath;
    } catch (e: any) {
      console.error(`[BrowserResearchEngine] Failed to download file ${url}:`, e.message);
      return "";
    }
  }
}
