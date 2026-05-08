import { createHmac } from "node:crypto";
import { env } from "./env.js";
import type { Account, Analysis, Result } from "./trust-types.js";

export type N8nPayload = {
  run_id: string;
  run_type: "weekly" | "daily_priority";
  company_name: string;
  domain: string;
  priority_tier: Account["priority_tier"];
  frameworks_present: string[];
  frameworks_missing: string[];
  recent_changes: string[];
  advisory_angles: string[];
  confidence: Analysis["confidence"];
  rationale: string;
  subprocessor_signal: "visible" | "gated" | "mentioned" | "not_found";
  subprocessor_notes: string;
  ai_signal: "visible" | "mentioned" | "not_found";
  ai_notes: string;
  checked_at: string;
  source_urls: string[];
};

export async function postToN8n(payload: N8nPayload): Promise<Result<{ status: number }>> {
  try {
    const url = env.n8n.webhookUrl;
    const secret = env.n8n.webhookSecret;
    const body = JSON.stringify(payload);
    const sig = secret ? createHmac("sha256", secret).update(body).digest("hex") : "";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(sig ? { "x-signature": sig } : {}),
      },
      body,
    });

    if (!res.ok) {
      return { ok: false, error: `n8n_http_${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    return { ok: true, data: { status: res.status } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
