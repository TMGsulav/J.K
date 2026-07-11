/**
 * Resolves redirect URLs, particularly Bing tracking and redirection URLs.
 * Extracts the final destination URL synchronously if base64 encoded, or asynchronously via a lightweight fetch.
 */
export async function resolveUrl(url: string): Promise<string> {
  if (!url) return url;

  const lowerUrl = url.toLowerCase();

  // 1. Check for Bing tracking URL with 'u=a1' parameter containing base64 URL
  if (lowerUrl.includes("bing.com/ck/a") || (lowerUrl.includes("bing.com") && url.includes("u="))) {
    try {
      const urlObj = new URL(url);
      const uParam = urlObj.searchParams.get("u");
      if (uParam) {
        // Strip prefixes like 'a1', 'a0', etc. base64 typically starts with 'aHR0c' (http)
        const base64Index = uParam.indexOf("aHR0c");
        if (base64Index !== -1) {
          let base64Part = uParam.substring(base64Index);
          // Clean base64 string
          base64Part = base64Part.replace(/[^A-Za-z0-9+/=]/g, "");
          
          // Add padding if required
          while (base64Part.length % 4 !== 0) {
            base64Part += "=";
          }
          
          const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
          if (decoded.startsWith("http")) {
            console.log(`[UrlResolver] Successfully decoded Bing tracking URL to destination: ${decoded}`);
            return decoded;
          }
        }
      }
    } catch (e: any) {
      console.error("[UrlResolver] Failed parsing Bing tracking URL parameter:", e.message);
    }

    // 2. Fallback: Fast HTTP request to follow redirects
    try {
      console.log(`[UrlResolver] Resolving redirect via fetch for URL: ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s limit

      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal as any,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeoutId);
      if (response.url && response.url !== url) {
        console.log(`[UrlResolver] Fetch successfully resolved Bing tracking URL to: ${response.url}`);
        return response.url;
      }
    } catch (e: any) {
      console.error("[UrlResolver] Fetch redirect resolution failed:", e.message);
    }
  }

  return url;
}

/**
 * Iterates through a list of SearchResults and resolves all URLs to their final destination.
 */
export async function resolveSearchResults(results: Array<{ title: string; url: string; snippet: string }>): Promise<Array<{ title: string; url: string; snippet: string }>> {
  if (!results || results.length === 0) return [];
  
  const resolved = await Promise.all(
    results.map(async item => {
      if (item.url && (item.url.includes("bing.com/ck/a") || item.url.includes("bing.com"))) {
        const finalUrl = await resolveUrl(item.url);
        return {
          ...item,
          url: finalUrl
        };
      }
      return item;
    })
  );

  return resolved.filter(item => item.url && !item.url.includes("bing.com/ck/a")); // Ensure no tracking URLs remain
}
