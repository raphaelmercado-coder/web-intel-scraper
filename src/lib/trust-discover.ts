import { env } from "./env.js";
import type { Result } from "./trust-types.js";

const KEYWORDS = ["trust", "security", "compliance", "privacy", "legal", "soc2", "iso27001", "gdpr", "hipaa", "status"];
const PATHS = ["/trust", "/security", "/compliance", "/privacy", "/legal", "/status"];
const SUBDOMAINS = ["trust", "security", "status"];

function buildCandidates(domain: string): string[] {
  const out = new Set<string>();
  for (const p of PATHS) out.add(`https://${domain}${p}`);
  for (const sd of SUBDOMAINS) out.add(`https://${sd}.${domain}`);
  return [...out];
}

function looksRelevant(url: string): boolean {
  const u = url.toLowerCase();
  return KEYWORDS.some((k) => u.includes(k));
}

type FirecrawlMapResponse = {
  success?: boolean;
  links?: string[];
  error?: string;
};

export async function discoverPages(domain: string, cap = 12): Promise<Result<string[]>> {
  try {
    const found = new Set<string>(buildCandidates(domain));

    for (const kw of KEYWORDS) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/map", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.firecrawl.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: `https://${domain}`, search: kw, limit: 20 }),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as FirecrawlMapResponse;
        for (const l of json.links ?? []) if (looksRelevant(l)) found.add(l);
      } catch {
        // per-keyword failure is non-fatal
      }
    }

    const ranked = [...found]
      .filter((u) => u.startsWith("http"))
      .sort((a, b) => Number(looksRelevant(b)) - Number(looksRelevant(a)))
      .slice(0, cap);

    return { ok: true, data: ranked };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
