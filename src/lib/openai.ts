import OpenAI from "openai";
import { env } from "./env.js";

export class OpenAIReportError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "OpenAIReportError";
    this.retryable = retryable;
  }
}

export interface ReportInput {
  companyName: string;
  industry: string;
  goal: string;
  challenge: string;
}

export interface ReportContent {
  executiveSummary: string;
  situationAnalysis: string;
  strategicRecommendations: string[];
  risks: string[];
  nextSteps: string[];
}

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a senior strategy consultant. Given a company's name, industry, goal, and primary challenge, produce a concise but substantive strategic report.

Return ONLY a JSON object matching this exact schema:
{
  "executiveSummary": string,           // 2-4 sentences
  "situationAnalysis": string,          // 1-2 paragraphs
  "strategicRecommendations": string[], // 3-6 specific, actionable items
  "risks": string[],                    // 2-5 items
  "nextSteps": string[]                 // 3-5 items, ordered
}

No markdown, no commentary, no extra keys.`;

export async function generateReport(input: ReportInput): Promise<ReportContent> {
  const client = new OpenAI({ apiKey: env.openai.apiKey });

  const userPrompt = `Company Name: ${input.companyName}
Industry: ${input.industry}
Goal: ${input.goal}
Primary Challenge: ${input.challenge}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);
    const retryable = !status || status >= 500 || status === 429;
    throw new OpenAIReportError(`OpenAI request failed: ${message}`, retryable);
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new OpenAIReportError("OpenAI returned empty content", true);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpenAIReportError("OpenAI returned non-JSON content", true);
  }

  return validate(parsed);
}

function validate(value: unknown): ReportContent {
  if (!value || typeof value !== "object") {
    throw new OpenAIReportError("Report content is not an object", false);
  }
  const v = value as Record<string, unknown>;
  const executiveSummary = asString(v.executiveSummary, "executiveSummary");
  const situationAnalysis = asString(v.situationAnalysis, "situationAnalysis");
  const strategicRecommendations = asStringArray(v.strategicRecommendations, "strategicRecommendations");
  const risks = asStringArray(v.risks, "risks");
  const nextSteps = asStringArray(v.nextSteps, "nextSteps");
  return { executiveSummary, situationAnalysis, strategicRecommendations, risks, nextSteps };
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OpenAIReportError(`Report field "${field}" missing or not a string`, false);
  }
  return value.trim();
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OpenAIReportError(`Report field "${field}" missing or empty`, false);
  }
  return value.map((item, idx) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new OpenAIReportError(`Report field "${field}[${idx}]" not a string`, false);
    }
    return item.trim();
  });
}
