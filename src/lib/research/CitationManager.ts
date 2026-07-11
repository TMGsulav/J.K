import { VerifiedSource } from "./SourceVerifier";

export interface Citation {
  index: number;
  title: string;
  url: string;
  sourceCategory: string;
  snippet?: string;
}

export class CitationManager {
  private citations: Map<string, Citation> = new Map();
  private currentIndex = 1;

  public registerSource(source: VerifiedSource): number {
    const existing = this.citations.get(source.url);
    if (existing) {
      return existing.index;
    }

    const index = this.currentIndex++;
    this.citations.set(source.url, {
      index,
      title: source.title,
      url: source.url,
      sourceCategory: source.sourceCategory,
      snippet: source.snippet
    });

    return index;
  }

  public registerMultiple(sources: VerifiedSource[]): void {
    for (const source of sources) {
      this.registerSource(source);
    }
  }

  public getCitationsList(): Citation[] {
    return Array.from(this.citations.values()).sort((a, b) => a.index - b.index);
  }

  public getFormattedMarkdown(): string {
    const list = this.getCitationsList();
    if (list.length === 0) return "";

    let md = "\n\n### 🌐 Verified Sources & References\n";
    for (const cite of list) {
      const categoryIcon = this.getCategoryIcon(cite.sourceCategory);
      md += `${cite.index}. [${categoryIcon} **${cite.title}**](${cite.url})\n`;
    }
    return md;
  }

  private getCategoryIcon(category: string): string {
    switch (category) {
      case "official_doc": return "📄 (Official Doc) ";
      case "official_website": return "🏢 (Official Site) ";
      case "github": return "💻 (GitHub) ";
      case "academic": return "🎓 (Academic Paper) ";
      case "government": return "🏛️ (Government) ";
      case "trusted_blog": return "📰 (Trusted News/Blog) ";
      case "forum": return "💬 (Community Forum) ";
      default: return "🔗 ";
    }
  }

  public clear(): void {
    this.citations.clear();
    this.currentIndex = 1;
  }
}
