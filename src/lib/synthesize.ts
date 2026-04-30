import { env } from "./env.js";
import {
  MAX_SYNTHESIS_INPUT_CHARS,
  SYNTHESIS_MODEL,
} from "./config.js";
import type { FirecrawlHit } from "./firecrawl.js";

export class SynthesisError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SynthesisError";
  }
}

export type Synthesis = {
  summary: string;
  keyPoints: string[];
  sources: string[];
};

const SYSTEM_PROMPT = `You are a research analyst. Given a topic and a set of source excerpts, produce a concise daily briefing.
Respond ONLY with strict JSON of the form:
{"summary": string, "keyPoints": string[], "sources": string[]}
- summary: 3-5 sentence narrative.
- keyPoints: 3-7 short bullet points capturing the most important facts.
- sources: URLs you actually used, drawn from the input.
Do not include any prose outside the JSON.`;

function buildUserMessage(topic: string, hits: FirecrawlHit[]): string {
  const blocks = hits.map((h, i) => {
    const body = (h.markdown ?? h.snippet ?? "").slice(0, 4000);
    return `### Source ${i + 1}\nTitle: ${h.title}\nURL: ${h.url}\n\n${body}`;
  });
  const joined = blocks.join("\n\n");
  const trimmed =
    joined.length > MAX_SYNTHESIS_INPUT_CHARS
      ? joined.slice(0, MAX_SYNTHESIS_INPUT_CHARS)
      : joined;
  return `Topic: ${topic}\n\nSources:\n${trimmed}`;
}

export async function synthesize(
  topic: string,
  hits: FirecrawlHit[],
): Promise<Synthesis> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SYNTHESIS_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(topic, hits) },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SynthesisError(
      `OpenAI synthesis failed: ${res.status} ${text}`,
      res.status,
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as Partial<Synthesis>;
    return {
      summary: parsed.summary ?? "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      sources: Array.isArray(parsed.sources)
        ? parsed.sources
        : hits.map((h) => h.url).filter(Boolean),
    };
  } catch {
    return {
      summary: content,
      keyPoints: [],
      sources: hits.map((h) => h.url).filter(Boolean),
    };
  }
}

export function fallbackSynthesis(
  topic: string,
  hits: FirecrawlHit[],
): Synthesis {
  const summary = hits.length
    ? `Synthesis fallback for "${topic}". Top snippets: ${hits
        .slice(0, 3)
        .map((h) => h.snippet)
        .filter(Boolean)
        .join(" | ")}`
    : `Synthesis fallback for "${topic}". No sources retrieved.`;
  return {
    summary,
    keyPoints: hits.slice(0, 5).map((h) => h.title).filter(Boolean),
    sources: hits.map((h) => h.url).filter(Boolean),
  };
}
