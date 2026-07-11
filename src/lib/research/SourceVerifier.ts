import { SearchResult } from "./SearchCache";

export interface VerifiedSource extends SearchResult {
  trustScore: number; // 0 to 100
  sourceCategory: "official_doc" | "official_website" | "github" | "academic" | "government" | "trusted_blog" | "forum" | "general";
}

export class SourceVerifier {
  private static TRUST_PATTERNS = {
    official_doc: [
      "docs.", "developer.", "learn.microsoft", "developer.mozilla", "mdn", "npmjs.com", "pub.dev",
      "pypi.org", "pkg.go.dev", "readthedocs", "git-scm.com", "help.github", "support.google"
    ],
    official_website: [
      "openai.com", "google.com", "anthropic.com", "microsoft.com", "apple.com", "meta.com", "amazon.com",
      "wikipedia.org", "w3.org", "ecma-international.org"
    ],
    github: [
      "github.com", "gitlab.com", "bitbucket.org"
    ],
    academic: [
      ".edu", "arxiv.org", "scholar.google", "researchgate.net", "springer.com", "nature.com", "ieee.org"
    ],
    government: [
      ".gov", ".gov.uk", ".mil", ".nic.in", "who.int", "nasa.gov"
    ],
    trusted_blog: [
      "medium.com", "dev.to", "hashnode.dev", "techcrunch.com", "theverge.com", "wired.com", "bloomberg.com",
      "reuters.com", "nytimes.com", "wsj.com", "infoworld.com", "zdnet.com"
    ],
    forum: [
      "reddit.com", "stackoverflow.com", "quora.com", "stackexchange.com", "news.ycombinator.com", "discord.com",
      "facebook.com", "twitter.com", "x.com", "linkedin.com", "instagram.com", "tiktok.com", "youtube.com", "pinterest.com"
    ]
  };

  public static classifyAndScore(result: SearchResult): VerifiedSource {
    const url = result.url.toLowerCase();
    let sourceCategory: VerifiedSource["sourceCategory"] = "general";
    let trustScore = 50; // base score

    // Check government
    if (this.TRUST_PATTERNS.government.some(p => url.includes(p))) {
      sourceCategory = "government";
      trustScore = 95;
    }
    // Check academic
    else if (this.TRUST_PATTERNS.academic.some(p => url.includes(p))) {
      sourceCategory = "academic";
      trustScore = 90;
    }
    // Check official docs
    else if (this.TRUST_PATTERNS.official_doc.some(p => url.includes(p))) {
      sourceCategory = "official_doc";
      trustScore = 90;
    }
    // Check official company website
    else if (this.TRUST_PATTERNS.official_website.some(p => url.includes(p))) {
      sourceCategory = "official_website";
      trustScore = 85;
    }
    // Check GitHub
    else if (this.TRUST_PATTERNS.github.some(p => url.includes(p))) {
      sourceCategory = "github";
      trustScore = 80;
    }
    // Check trusted tech blog / news
    else if (this.TRUST_PATTERNS.trusted_blog.some(p => url.includes(p))) {
      sourceCategory = "trusted_blog";
      trustScore = 70;
    }
    // Check forum (secondary references)
    else if (this.TRUST_PATTERNS.forum.some(p => url.includes(p))) {
      sourceCategory = "forum";
      trustScore = 40; // lower priority
    }

    return {
      ...result,
      trustScore,
      sourceCategory
    };
  }

  public static verifyAndSort(results: SearchResult[]): VerifiedSource[] {
    if (!results || results.length === 0) return [];
    
    return results
      .map(r => this.classifyAndScore(r))
      .sort((a, b) => b.trustScore - a.trustScore); // highest score first
  }
}
