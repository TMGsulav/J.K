import { GoogleGenAI } from "@google/genai";
import { VerifiedSource } from "./SourceVerifier";
import { PageContent } from "./PageReader";
import { CitationManager } from "./CitationManager";

export class Summarizer {
  private citationManager: CitationManager;

  constructor(citationManager: CitationManager) {
    this.citationManager = citationManager;
  }

  public async synthesize(
    userMessage: string,
    sources: VerifiedSource[],
    pages: PageContent[],
    getAI: () => GoogleGenAI | null
  ): Promise<string> {
    const ai = getAI();
    if (!ai) {
      throw new Error("Gemini AI Client is not initialized.");
    }

    // Register sources to CitationManager
    this.citationManager.registerMultiple(sources);

    // Format search results and fetched page contents for LLM context
    let sourcesContext = "";
    let hasSources = sources.length > 0;

    if (hasSources) {
      sourcesContext = "# WEB SEARCH RESULTS AND RETRIEVED PAGE CONTENTS\n\n## Search Snippets:\n";
      for (const source of sources) {
        const idx = this.citationManager.registerSource(source);
        sourcesContext += `[Source ${idx}] (Title: ${source.title}, URL: ${source.url}, Category: ${source.sourceCategory})\nSnippet: ${source.snippet}\n\n`;
      }

      // Add fetched page content details
      const successfulPages = pages.filter(p => p.success && p.content);
      if (successfulPages.length > 0) {
        sourcesContext += "## Full Page Content Extracts:\n";
        for (const page of successfulPages) {
          const matchingSource = sources.find(s => s.url === page.url);
          let idx = 0;
          if (matchingSource) {
            idx = this.citationManager.registerSource(matchingSource);
          } else {
            // Register dynamic new source
            idx = this.citationManager.registerSource({
              title: page.title || "Web Resource",
              url: page.url,
              snippet: page.content.substring(0, 100),
              trustScore: 60,
              sourceCategory: "general"
            });
          }
          sourcesContext += `--- BEGIN PAGE CONTENT [Source ${idx}] (URL: ${page.url}) ---\n${page.content}\n--- END PAGE CONTENT [Source ${idx}] ---\n\n`;
        }
      }
    }

    const synthesisPrompt = hasSources 
      ? `You are Liya's Real-Time Deep Research Summarization Engine.
Your task is to synthesize a beautifully structured, highly factual, up-to-date, and objective response to the User Request based exclusively on the provided Web Search Results and Page Contents.

User Request: "${userMessage}"

${sourcesContext}

# INSTRUCTIONS:
1. Synthesize all findings clearly. If the question is complex or comparative (e.g. comparing Claude, Gemini, DeepSeek, GPT-5.5), compare them along major facets (features, access, pricing, capabilities) in structured tables, lists, or bold comparisons.
2. ALWAYS verify facts across multiple sources. Never rely on a single snippet if other sources contain conflicting or more recent data. Cite the contradictions clearly if present.
3. INLINE CITATIONS ARE MANDATORY: Whenever you state a key fact, release date, version, cryptocurrency price, or news event, append the source index in square brackets, e.g., "[1]" or "[1, 3]".
4. Do NOT refer to yourself as "the Summarization Engine" or "LLM" or "system". Answer directly as Liya, a friendly, intelligent companion. Maintain her supportive, conversational, and articulate tone.
5. List the sources gracefully. Inline citations MUST correspond exactly to the indices of the registered sources (from [1] to [N]).
6. Make sure there is NO hallucination of links or details that do not exist in the provided context. If the source material does not answer the user's question, say so honestly and offer the closest verified fact.

Response output should be in elegant GitHub-Flavored Markdown.
`
      : `You are Liya, an extremely helpful, intelligent, and friendly AI companion.
Your task is to synthesize a beautifully structured, elegant, and comprehensive response to the User Request using your internal general knowledge. No live search results are needed for this static query.

User Request: "${userMessage}"

# INSTRUCTIONS:
1. Provide a detailed, clear, and extremely accurate answer directly as Liya.
2. Maintain a supportive, conversational, articulate, and friendly tone.
3. Organize the response using clear headings, bullet points, or structured comparisons where appropriate.
4. Do NOT include any citations or link footers as no external sources were used.

Response output should be in elegant GitHub-Flavored Markdown.
`;

    try {
      const { callWithRetry } = await import("./GeminiRetry");
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: synthesisPrompt
        })
      );

      let synthesizedText = response.text || "I was unable to synthesize a response from the retrieved sources.";

      // Log Gemini Request metrics to Dashboard
      try {
        const { BrowserResearchEngine } = await import("./BrowserResearchEngine");
        const promptLength = synthesisPrompt.length;
        const respLength = synthesizedText.length;
        const totalEstimatedTokens = Math.round((promptLength + respLength) / 4);
        BrowserResearchEngine.getInstance().logGeminiRequest(totalEstimatedTokens);
      } catch (err) {
        // silent fail for metric logger
      }

      // Append formatted citation footer
      const citationFooter = this.citationManager.getFormattedMarkdown();
      if (citationFooter) {
        synthesizedText += citationFooter;
      }

      return synthesizedText;
    } catch (e: any) {
      console.error("[Summarizer] Synthesis failed:", e);
      throw new Error(`Failed to synthesize results: ${e.message}`);
    }
  }
}
