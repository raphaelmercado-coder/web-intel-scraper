import { env } from "./env.js";
import type { Account, Result } from "./trust-types.js";

const KEYWORDS = ["trust", "security", "compliance", "privacy", "legal", "soc2", "iso27001", "gdpr", "hipaa", "status"];
// Only these are worth a Firecrawl map call — the rest are rarely in URLs
const MAP_KEYWORDS = ["trust", "security", "compliance", "privacy"];
const PATHS = ["/trust", "/security", "/compliance", "/privacy", "/legal", "/status"];
const SUBDOMAINS = ["trust", "security", "status"];

export type DiscoverHints = Pick<
  Account,
  "trust_center_url" | "security_url" | "has_visible_trust_center" | "collector_mode"
>;

function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildCandidates(domain: string, hints?: Partial<DiscoverHints>): { url: string; hinted: boolean }[] {
  const out = new Set<string>();
  const hinted = new Set<string>();

  for (const url of buildHintUrls(hints)) {
    out.add(url);
    hinted.add(url);
  }

  for (const p of PATHS) out.add(`https://${domain}${p}`);
  for (const sd of SUBDOMAINS) out.add(`https://${sd}.${domain}`);
  return [...out].map((url) => ({ url, hinted: hinted.has(url) }));
}

function buildHintUrls(hints?: Partial<DiscoverHints>): string[] {
  const hintUrls =
    hints?.collector_mode === "security_first"
      ? [hints.security_url, hints.trust_center_url]
      : [hints?.trust_center_url, hints?.security_url];

  const out = new Set<string>();
  for (const raw of hintUrls) {
    const url = normalizeUrl(raw ?? "");
    if (!url) continue;
    out.add(url);
  }
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

export async function discoverPages(
  domain: string,
  cap = 6,
  hints?: Partial<DiscoverHints>,
): Promise<Result<string[]>> {
  try {
    const hintedUrls = buildHintUrls(hints);
    if (hintedUrls.length > 0) {
      return { ok: true, data: hintedUrls.slice(0, cap) };
    }

    const found = new Map<string, { hinted: boolean }>();
    for (const candidate of buildCandidates(domain, hints)) {
      found.set(candidate.url, { hinted: candidate.hinted });
    }

    const skipMap = hints?.collector_mode === "domain_only";

    if (!skipMap) {
      for (const kw of MAP_KEYWORDS) {
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
          for (const l of json.links ?? []) {
            if (looksRelevant(l)) found.set(l, { hinted: found.get(l)?.hinted ?? false });
          }
        } catch {
          // per-keyword failure is non-fatal
        }
      }
    }

    const ranked = [...found.entries()]
      .filter(([url]) => url.startsWith("http"))
      .sort(
        ([a, aMeta], [b, bMeta]) =>
          Number(bMeta.hinted) * 10 +
          Number(looksRelevant(b)) -
          (Number(aMeta.hinted) * 10 + Number(looksRelevant(a))),
      )
      .map(([url]) => url)
      .slice(0, cap);

    return { ok: true, data: ranked };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
