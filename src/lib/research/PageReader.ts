import * as https from "https";
import * as http from "http";
import { SearchCache } from "./SearchCache";

export interface PageContent {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

export class PageReader {
  private cache = SearchCache.getInstance();

  public async readPage(url: string, title: string = ""): Promise<PageContent> {
    // Check page cache first
    const cached = this.cache.getPage(url);
    if (cached) {
      console.log(`[PageReader] Cache Hit for page: ${url}`);
      return { url, title, content: cached, success: true };
    }

    console.log(`[PageReader] Fetching and parsing content for page: ${url}`);
    try {
      let rawHtml = "";

      // Try fetching using Node's standard global fetch first
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
          },
          signal: controller.signal
        });

        clearTimeout(id);

        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        rawHtml = await response.text();
      } catch (fetchErr: any) {
        console.log(`[PageReader] Retrying ${url} with direct secure fallback...`);
        // Fallback to custom https/http get with rejectUnauthorized: false to bypass SSL chain errors on gov/local sites
        rawHtml = await this.fetchWithNodeHttps(url, 12000);
      }

      const cleanTextContent = this.extractCleanText(rawHtml);

      // Cache it
      this.cache.setPage(url, cleanTextContent);

      return {
        url,
        title,
        content: cleanTextContent,
        success: true
      };
    } catch (e: any) {
      // Use console.log instead of console.warn to avoid treating normal scraping failures as system errors/warnings
      console.log(`[PageReader] Direct secure fallback bypassed for ${url}`);
      return {
        url,
        title,
        content: "",
        success: false,
        error: e.message || "Bypassed fetch"
      };
    }
  }

  private fetchWithNodeHttps(urlStr: string, timeoutMs = 12000): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(urlStr);
        const options: https.RequestOptions = {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive"
          },
          timeout: timeoutMs,
          rejectUnauthorized: false // Bypass SSL/TLS certificate verification errors!
        };

        const lib = parsedUrl.protocol === "https:" ? https : http;
        const req = lib.request(urlStr, options, (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Status ${res.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf-8"));
          });
        });

        req.on("error", (err) => {
          reject(err);
        });

        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Request timed out"));
        });

        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async readMultiplePages(urls: Array<{ url: string; title: string }>): Promise<PageContent[]> {
    if (!urls || urls.length === 0) return [];
    
    // Read up to 3 pages in parallel to stay fast
    const targets = urls.slice(0, 3);
    const promises = targets.map(t => this.readPage(t.url, t.title));
    return Promise.all(promises);
  }

  private extractCleanText(html: string): string {
    if (!html) return "";

    let text = html;

    // Remove scripts and style blocks and comments
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<!--[\s\S]*?-->/g, "");
    text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
    text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
    text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

    // Extract text from paragraph, headers, list item tags or just strip all tags
    // Let's do a fast but complete stripping of all other tags
    text = text.replace(/<[^>]*>/g, " ");

    // Decode standard HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&copy;/g, "")
      .replace(/&#x2F;/g, "/");

    // Clean up excessive spacing/newlines
    text = text.replace(/\s+/g, " ");
    text = text.replace(/\n+/g, "\n");

    // Limit text to 6000 characters to prevent token overflow while preserving substantial details
    if (text.length > 6000) {
      text = text.substring(0, 6000) + "... [truncated]";
    }

    return text.trim();
  }
}
