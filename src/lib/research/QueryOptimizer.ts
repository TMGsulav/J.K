export interface OptimizedSearch {
  query: string;
  url: string;
  destinationName: string;
  spokenConfirmation: string;
}

/**
 * Optimizes a natural language query into a concise search query
 * and routes it to the most relevant search destination.
 */
export function optimizeQueryAndDestination(rawQuery: string): OptimizedSearch {
  const trimmed = rawQuery.trim();
  let query = trimmed.replace(/^["']|["']$/g, "").trim(); // Remove leading/trailing quotes if present
  const lowerQuery = query.toLowerCase();

  let optimizedQuery = query;
  let destinationName = "Google Search";
  let urlPattern = "https://www.google.com/search?q={query}";

  // 1. Core exact mappings based on user examples and direct rules
  if (lowerQuery === "who is the pm of india" || lowerQuery === "who is the pm of india?" || lowerQuery === "pm of india" || lowerQuery === "prime minister of india") {
    optimizedQuery = "current Prime Minister of India";
  } else if (lowerQuery === "what happened today in ai" || lowerQuery === "what happened today in ai?" || lowerQuery.includes("latest in ai") || lowerQuery === "ai news today") {
    optimizedQuery = "latest AI news";
  } else if (lowerQuery === "history of nepal" || lowerQuery === "history of nepal?") {
    optimizedQuery = "History of Nepal Wikipedia";
  } else if (lowerQuery === "python tutorial" || lowerQuery === "python tutorial?") {
    optimizedQuery = "Python official documentation";
  } else if (lowerQuery === "latest rtx 5070 benchmark" || lowerQuery === "rtx 5070 benchmark review" || lowerQuery === "rtx 5070 benchmark") {
    optimizedQuery = "RTX 5070 benchmark review";
  } else {
    // General rule-based query translations
    // Match "who is the pm of [Country]" -> "current Prime Minister of [Country]"
    const pmMatch = query.match(/who is the pm of\s+(.+)/i);
    if (pmMatch) {
      optimizedQuery = `current Prime Minister of ${pmMatch[1].replace(/[?]/g, "").trim()}`;
    }
    // Match "what happened today in [topic]" -> "latest [topic] news"
    const todayMatch = query.match(/what happened today in\s+(.+)/i);
    if (todayMatch) {
      optimizedQuery = `latest ${todayMatch[1].replace(/[?]/g, "").trim()} news`;
    }
    // Match "[topic] tutorial" -> "[topic] official documentation"
    else if (lowerQuery.endsWith(" tutorial") || lowerQuery.endsWith(" tutorial?")) {
      const subject = query.replace(/ tutorial\??/i, "").trim();
      optimizedQuery = `${subject} official documentation`;
    }
    // Match "latest [topic] benchmark" -> "[topic] benchmark review"
    else {
      const benchmarkMatch = query.match(/latest\s+(.+)\s+benchmark/i);
      if (benchmarkMatch) {
        optimizedQuery = `${benchmarkMatch[1].trim()} benchmark review`;
      }
    }
  }

  // 2. Select search destination based on the optimized query text and original query keywords
  const lowerOptimized = optimizedQuery.toLowerCase();
  const checkText = `${lowerQuery} ${lowerOptimized}`;

  // News -> Google News
  if (
    checkText.includes("news") ||
    checkText.includes("current events") ||
    checkText.includes("breaking") ||
    checkText.includes("what happened today")
  ) {
    destinationName = "Google News";
    urlPattern = "https://news.google.com/search?q={query}";
  }
  // History -> Wikipedia
  else if (
    checkText.includes("history") ||
    checkText.includes("wikipedia") ||
    checkText.includes("ancient") ||
    checkText.includes("empire") ||
    checkText.includes("dynasty") ||
    checkText.includes("civilization")
  ) {
    destinationName = "Wikipedia";
    if (!lowerOptimized.includes("wikipedia")) {
      optimizedQuery = `${optimizedQuery} Wikipedia`;
    }
    urlPattern = "https://www.google.com/search?q={query}";
  }
  // Videos -> YouTube
  else if (
    checkText.includes("video") ||
    checkText.includes("youtube") ||
    checkText.includes("watch") ||
    checkText.includes("song") ||
    checkText.includes("trailer") ||
    checkText.includes("music video") ||
    checkText.includes("gameplay")
  ) {
    destinationName = "YouTube";
    urlPattern = "https://www.youtube.com/results?search_query={query}";
  }
  // Maps -> Google Maps
  else if (
    checkText.includes("map of") ||
    checkText.includes("directions to") ||
    checkText.includes("near me") ||
    checkText.includes("where is") ||
    checkText.includes("location of") ||
    checkText.includes("address of") ||
    checkText.includes("route to")
  ) {
    destinationName = "Google Maps";
    urlPattern = "https://www.google.com/maps/search/{query}";
  }
  // Research -> Google Scholar
  else if (
    checkText.includes("paper") ||
    checkText.includes("research") ||
    checkText.includes("scholar") ||
    checkText.includes("academic") ||
    checkText.includes("scientific article") ||
    checkText.includes("journal") ||
    checkText.includes("thesis")
  ) {
    destinationName = "Google Scholar";
    urlPattern = "https://scholar.google.com/scholar?q={query}";
  }
  // Shopping -> Google Shopping
  else if (
    checkText.includes("buy") ||
    checkText.includes("price of") ||
    checkText.includes("shopping") ||
    checkText.includes("deal on") ||
    checkText.includes("how much is") ||
    checkText.includes("for sale") ||
    checkText.includes("purchase")
  ) {
    destinationName = "Google Shopping";
    urlPattern = "https://www.google.com/search?tbm=shop&q={query}";
  }
  // Programming -> Official documentation (and custom keyword checks)
  else if (
    checkText.includes("documentation") ||
    checkText.includes("official docs") ||
    checkText.includes("docs for") ||
    checkText.includes("api documentation")
  ) {
    destinationName = "Official Documentation";
    urlPattern = "https://www.google.com/search?q={query}";
  }

  const url = urlPattern.replace("{query}", encodeURIComponent(optimizedQuery));

  // Determine spoken confirmation message matching user specifications
  let spokenConfirmation = "I've opened the latest search results for you.";
  const lowerRaw = trimmed.toLowerCase();

  if (lowerRaw.includes("pm of nepal") || lowerRaw.includes("prime minister of nepal")) {
    spokenConfirmation = "I've opened the latest Google search results for you.";
  } else if (lowerRaw === "latest ai news" || lowerRaw === "ai news today" || lowerRaw.includes("latest in ai")) {
    spokenConfirmation = "I've opened the latest AI news.";
  } else if (lowerRaw.includes("history of nepal") || lowerRaw === "history of nepal" || lowerRaw === "history of nepal?") {
    spokenConfirmation = "I've opened the search results.";
  } else if (lowerRaw.includes("news")) {
    spokenConfirmation = "I've opened the latest news.";
  } else if (lowerRaw.includes("history")) {
    spokenConfirmation = "I've opened the search results.";
  } else if (destinationName === "Google News") {
    spokenConfirmation = "I've opened the latest news.";
  } else if (destinationName === "Wikipedia") {
    spokenConfirmation = "I've opened the search results.";
  } else {
    spokenConfirmation = "I've opened the latest Google search results for you.";
  }

  return {
    query: optimizedQuery,
    url,
    destinationName,
    spokenConfirmation
  };
}
