import type { Result, ScrapedPage, Snapshot } from "./trust-types.js";

export type DiffResult = {
  changed_urls: string[];
  new_urls: string[];
  removed_urls: string[];
  per_url_summary: Record<string, { changed: boolean; added_lines: number; removed_lines: number }>;
};

function lineDiff(prev: string, next: string) {
  const a = new Set(prev.split("\n").map((l) => l.trim()).filter(Boolean));
  const b = new Set(next.split("\n").map((l) => l.trim()).filter(Boolean));
  let added = 0, removed = 0;
  for (const l of b) if (!a.has(l)) added++;
  for (const l of a) if (!b.has(l)) removed++;
  return { added, removed };
}

export function diffAgainstLast(current: ScrapedPage[], previous: Snapshot | null): Result<DiffResult> {
  try {
    const prevByUrl = new Map<string, ScrapedPage>();
    if (previous) for (const p of previous.pages) prevByUrl.set(p.url, p);
    const currByUrl = new Map(current.map((p) => [p.url, p]));

    const changed_urls: string[] = [];
    const new_urls: string[] = [];
    const per_url_summary: DiffResult["per_url_summary"] = {};

    for (const [url, page] of currByUrl) {
      const prior = prevByUrl.get(url);
      if (!prior) {
        new_urls.push(url);
        per_url_summary[url] = { changed: true, added_lines: page.markdown.split("\n").length, removed_lines: 0 };
        continue;
      }
      if (prior.hash !== page.hash) {
        const { added, removed } = lineDiff(prior.markdown, page.markdown);
        changed_urls.push(url);
        per_url_summary[url] = { changed: true, added_lines: added, removed_lines: removed };
      } else {
        per_url_summary[url] = { changed: false, added_lines: 0, removed_lines: 0 };
      }
    }

    const removed_urls = [...prevByUrl.keys()].filter((u) => !currByUrl.has(u));
    return { ok: true, data: { changed_urls, new_urls, removed_urls, per_url_summary } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
