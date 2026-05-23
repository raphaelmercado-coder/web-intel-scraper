# Workflow: Per-Account Pipeline

## Objective
For a single account, discover relevant pages on the target site, scrape them, detect changes vs. the last snapshot, analyze the content, and post a qualified finding to the webhook if warranted.

## Inputs
A single `Account` object plus the parent `run_id` and `run_type`.

## Steps

1. **Discover pages** (`src/lib/trust-discover.ts`)
   - Build candidate URLs from domain heuristics (subdomains, common paths).
   - Call Firecrawl `/map` with search keywords.
   - Dedupe and cap at 6 URLs.
   - If discovery yields 0 URLs, log and return `{ status: "skipped", reason: "no_pages_found" }`.

2. **Scrape pages** (`src/lib/trust-scrape.ts`)
   - Firecrawl `/scrape` per URL, format `markdown`.
   - Per-URL try/catch — failed URLs are recorded but the account continues if at least 1 page succeeds.
   - If all scrapes fail, mark domain unreachable in the Accounts sheet and return `{ status: "skipped", reason: "all_scrapes_failed" }`.

3. **Diff against last snapshot** (`src/lib/trust-diff.ts`)
   - Load most recent snapshot from `temp/resources/snapshots/<domain>/`.
   - For each URL, compute a content hash + line-level diff.
   - Output: `{ new_urls, changed_urls, removed_urls }`.

4. **Analyze** (`src/lib/trust-analyze.ts`)
   - Send account metadata, scraped content, and diff to OpenAI.
   - Receive structured JSON validated by Zod: signals present/absent, recent changes, outreach hooks, qualified flag, confidence, rationale.

5. **Write hints back** (`src/lib/trust-seed.ts`)
   - Update discovered URL hints and detected signals in the Accounts sheet for future runs.

6. **Persist snapshot** (`src/lib/trust-snapshot.ts`)
   - Write `temp/resources/snapshots/<domain>/<YYYY-MM-DD>.json`.

7. **Post to webhook** (`src/lib/trust-n8n.ts`)
   - If `qualified === true` OR signals were detected.
   - POST signed payload (HMAC of body using `N8N_TRUST_WEBHOOK_SECRET`) to `N8N_TRUST_WEBHOOK_URL`.

## Failure Handling
- Every lib module returns `{ ok: true, data } | { ok: false, error }`. The orchestrator never throws on expected failures.
- Steps 1 or 2 returning empty → account is marked `skipped`, not `failed`.
- Unhandled exception → caught at task boundary, logged, account marked `failed`.
- Task retries: 2 max attempts, 2x exponential backoff, 2–15s timeout.

## Logging
Every major step emits a structured log line via `logger.info/warn/error` from `@trigger.dev/sdk`.
