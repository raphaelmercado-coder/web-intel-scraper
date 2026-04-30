import { env } from "./env.js";

export class FirecrawlError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "FirecrawlError";
  }
}

export type FirecrawlHit = {
  title: string;
  url: string;
  snippet: string;
  markdown?: string;
};

type FirecrawlSearchResponse = {
  success?: boolean;
  data?: {
    web?: Array<{
      title?: string;
      url?: string;
      description?: string;
      markdown?: string;
    }>;
  };
  error?: string;
};

export async function searchTopic(
  query: string,
  limit: number,
): Promise<FirecrawlHit[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.firecrawl.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new FirecrawlError(
      `Firecrawl search failed: ${res.status} ${text}`,
      res.status,
    );
  }

  const json = (await res.json()) as FirecrawlSearchResponse;
  const web = json.data?.web ?? [];

  return web.map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.description ?? "",
    markdown: r.markdown,
  }));
}
