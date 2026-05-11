import OpenAI from "openai";
import { env } from "./env.js";
import { AnalysisSchema, type Account, type Analysis, type Result, type ScrapedPage } from "./trust-types.js";
import type { DiffResult } from "./trust-diff.js";

const SYSTEM_PROMPT = `You are a security/compliance analyst supporting an advisory team that sells GRC services.
Given an account profile, scraped trust/security/legal pages, and a diff vs. the prior snapshot, produce a strict JSON object that:
- lists frameworks the company clearly publishes (SOC 2 Type I/II, ISO 27001, ISO 27701, HIPAA, PCI DSS, FedRAMP, GDPR, CCPA, etc.)
- lists frameworks they likely should have given their industry/segment but don't show
- summarizes real content changes (only when the diff shows them)
- proposes 1-3 advisory_angles (concrete outreach hooks, not generic)
- sets qualified=true ONLY if there is a real gap, real change, or strong advisory hook worth surfacing this week
- assigns confidence based on evidence strength
- classifies subprocessor disclosure: "visible" if a subprocessor list exists on the page, "gated" if access is required to view it, "mentioned" if referenced without a list, "not_found" if absent; add a short subprocessor_notes string
- classifies AI security/governance: "visible" if a dedicated AI policy or governance section exists, "mentioned" if AI is referenced incidentally (e.g. training disclaimer), "not_found" if absent; add a short ai_notes string covering any AI policy, model training disclaimers, ISO 42001, NIST AI RMF, SOC 2 AI controls, or human review language found
Output ONLY valid JSON matching the requested schema.`;

function cleanMarkdown(s: string): string {
  return s
    .replace(/\[!\[([^\]]*)\]\([^)]*\)\]\([^)]*\)/g, "$1") // [![alt](img)](link) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")               // ![alt](url) → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");               // [text](url) → text
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max) + "\n…[truncated]";
}

export async function analyzePosture(
  account: Account,
  pages: ScrapedPage[],
  diff: DiffResult,
): Promise<Result<Analysis>> {
  try {
    const client = new OpenAI({ apiKey: env.openai.apiKey });
    const pageBlobs = pages.map((p) => `### ${p.url}\n${truncate(cleanMarkdown(p.markdown), 4000)}`).join("\n\n");

    const userPrompt = [
      `Account: ${account.company_name} (${account.domain})`,
      `Industry: ${account.industry} | Segment: ${account.segment} | Priority: ${account.priority_tier}`,
      `Known frameworks (from CRM): ${account.known_frameworks.join(", ") || "none on file"}`,
      `Trust center URL hint: ${account.trust_center_url || "none"}`,
      `Security URL hint: ${account.security_url || "none"}`,
      `Visible trust center: ${account.has_visible_trust_center ? "yes" : "no"} | Collector mode: ${account.collector_mode}`,
      `Notes: ${account.notes || "—"}`,
      "",
      `Diff vs last snapshot:`,
      `- new_urls: ${diff.new_urls.join(", ") || "none"}`,
      `- changed_urls: ${diff.changed_urls.join(", ") || "none"}`,
      `- removed_urls: ${diff.removed_urls.join(", ") || "none"}`,
      "",
      `Pages:`,
      pageBlobs || "(no pages scraped)",
      "",
      `Return JSON with keys: frameworks_present (string[]), frameworks_missing (string[]), recent_changes (string[]), advisory_angles (string[], max 5), qualified (boolean), confidence ("low"|"medium"|"high"), rationale (string), subprocessor_signal ("visible"|"gated"|"mentioned"|"not_found"), subprocessor_notes (string), ai_signal ("visible"|"mentioned"|"not_found"), ai_notes (string).`,
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: env.trust.openaiModel,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = AnalysisSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { ok: false, error: `analysis_schema_invalid: ${parsed.error.message}` };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
