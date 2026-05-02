import { createHash } from "node:crypto";
import { env } from "./env.js";
import type { Result, ScrapedPage } from "./trust-types.js";

type FirecrawlScrapeResponse = {
  success?: boolean;
  markdown?: string;
  data?: { markdown?: string };
  error?: string;
};

export async function scrapePages(
  urls: string[],
  options?: { waitFor?: number },
): Promise<Result<{ pages: ScrapedPage[]; failed: { url: string; error: string }[] }>> {
  try {
    const pages: ScrapedPage[] = [];
    const failed: { url: string; error: string }[] = [];

    for (const url of urls) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.firecrawl.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, ...(options?.waitFor ? { waitFor: options.waitFor } : {}) }),
        });
        if (!res.ok) {
          failed.push({ url, error: `http_${res.status}` });
          continue;
        }
        const json = (await res.json()) as FirecrawlScrapeResponse;
        const md = json.markdown ?? json.data?.markdown ?? "";
        if (!md.trim()) {
          failed.push({ url, error: "empty_markdown" });
          continue;
        }
        pages.push({
          url,
          markdown: md,
          hash: createHash("sha256").update(md).digest("hex"),
          scraped_at: new Date().toISOString(),
        });
      } catch (err) {
        failed.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { ok: true, data: { pages, failed } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
