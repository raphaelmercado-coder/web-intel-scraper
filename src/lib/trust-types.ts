import { z } from "zod";

export const AccountSchema = z.object({
  company_name: z.string().min(1),
  domain: z.string().min(1),
  industry: z.string().default(""),
  segment: z.string().default(""),
  priority_tier: z.enum(["high", "medium", "low"]).default("medium"),
  known_frameworks: z.array(z.string()).default([]),
  last_checked_at: z.string().default(""),
  notes: z.string().default(""),
});
export type Account = z.infer<typeof AccountSchema>;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export const AnalysisSchema = z.object({
  frameworks_present: z.array(z.string()),
  frameworks_missing: z.array(z.string()),
  recent_changes: z.array(z.string()),
  advisory_angles: z.array(z.string()).max(5),
  qualified: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export type ScrapedPage = {
  url: string;
  markdown: string;
  hash: string;
  scraped_at: string;
};

export type Snapshot = {
  domain: string;
  taken_at: string;
  resolved_urls: string[];
  pages: ScrapedPage[];
  analysis?: Analysis;
};
