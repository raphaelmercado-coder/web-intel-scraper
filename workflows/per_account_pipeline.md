# Workflow: Per-Account Pipeline

## Objective
For a single account, discover trust-related pages, scrape them, detect changes vs. last snapshot, analyze compliance posture, and post a qualified finding to n8n if warranted.

## Inputs
A single `Account` object plus the parent `run_id` and `run_type`.

## Steps
1. **Discover pages** (`tools/discover_pages.ts`)
   - Build candidate URLs from heuristics (`trust.<domain>`, `<domain>/security`, etc.).
   - Call Firecrawl `/map` with search keywords (`trust`, `security`, `compliance`, `privacy`, `legal`, `soc 2`, `iso 27001`, `gdpr`, `hipaa`, `status`).
   - Dedupe, cap at 12 URLs.
   - If discovery yields 0 URLs, log and return `{ status: "skipped", reason: "no_pages_found" }`.

2. **Scrape pages** (`tools/scrape_pages.ts`)
   - Firecrawl `/scrape` per URL, format `markdown`, follow redirects.
   - Per-URL try/catch — failed URLs are recorded but the account continues if at least 1 page succeeds.

3. **Diff against last snapshot** (`tools/diff_against_last.ts`)
   - Load most recent snapshot under `temp/resources/snapshots/<domain>/`.
   - For each URL, compute a content hash + line-level diff.
   - Output: `{ changed_urls: [...], diff_summary_per_url: {...} }`.

4. **Analyze posture** (`tools/analyze_posture.ts`)
   - Send (account metadata, scraped markdown, diff summary) to OpenAI.
   - Receive strict-JSON output validated by Zod: frameworks_present, frameworks_missing, recent_changes, advisory_angles, qualified, confidence, rationale.

5. **Post to n8n** (`tools/post_to_n8n.ts`)
   - Only if `qualified === true`.
   - POST signed payload (HMAC of body using `N8N_WEBHOOK_SECRET`) to `N8N_WEBHOOK_URL`.

6. **Persist snapshot** (`tools/snapshot_store.ts`)
   - Write `temp/resources/snapshots/<domain>/<YYYY-MM-DD>.json` with scraped markdown, hashes, resolved URLs, analysis result.

## Failure handling
- Every tool returns `{ ok: true, data } | { ok: false, error }`. The orchestrator never throws.
- If steps 1 or 2 return ok-but-empty, the account is marked `skipped`, not `failed`.
- A thrown exception from any step is caught at the task boundary, logged as `step_error`, and the account is marked `failed`.

## Logging
Every step emits one structured line via `tools/logger.ts`:
`{ run_id, account: domain, step, status, duration_ms, error? }`.
