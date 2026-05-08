# Trust Center Scraper Codemap

## Top-Level Flow

```text
Trigger schedule
  trust-weekly-sweep
    -> loads Accounts sheet
    -> batches accounts in groups of 5
    -> calls trust-process-account for each account
      -> discover URLs
      -> scrape pages with Firecrawl
      -> diff against last snapshot
      -> analyze with OpenAI
      -> update Accounts sheet hints/frameworks
      -> write snapshot
      -> post qualified findings to n8n
    -> writes run summary
    -> updates last_checked_at
```

## Trigger Tasks

### `src/trigger/trust-weekly-sweep.ts`

Owns the weekly parent run. Loads all accounts, batches them, waits for child runs, writes a summary to `temp/outputs`, and updates `last_checked_at`.

### `src/trigger/trust-daily-priority.ts`

Uses the same parent/child pattern as weekly sweep, but filters the seed list to `priority_tier === "high"`.

### `src/trigger/trust-process-account.ts`

The main per-account orchestrator. This is where the step order lives. If the pipeline needs a new phase, this is usually where it gets inserted.

## Trust Pipeline Modules

### `src/lib/trust-seed.ts`

Google Sheets account source of truth. Reads the Accounts tab and writes back discovery hints, frameworks, `last_checked_at`, and unreachable trust-center flags.

### `src/lib/trust-discover.ts`

URL discovery policy. This is where the hinted-URL behavior lives. Future changes about which URLs Firecrawl should touch belong here.

Current policy:

- If `trust_center_url` or `security_url` exists, return only those hinted URLs.
- Preserve `security_first` ordering when `collector_mode` is set that way.
- If no hints exist, fall back to guessed trust/security/legal paths and Firecrawl `/map`.

### `src/lib/trust-scrape.ts`

Firecrawl `/v1/scrape` calls. Future changes about scrape format, `waitFor`, `onlyMainContent`, retry behavior, or markdown extraction belong here.

### `src/lib/trust-diff.ts`

Compares current scraped pages against the previous snapshot by URL/hash and line differences.

### `src/lib/trust-analyze.ts`

OpenAI compliance analysis. Owns the analyst prompt, model call, JSON parsing, and `AnalysisSchema` validation.

### `src/lib/trust-snapshot.ts`

Local snapshot persistence under `temp/resources/snapshots/<domain>/<YYYY-MM-DD>.json`.

### `src/lib/trust-n8n.ts`

Posts qualified findings to n8n, including optional HMAC signature.

### `src/lib/trust-types.ts`

Shared schemas and types: `Account`, `ScrapedPage`, `Snapshot`, `Analysis`, and `Result`.

## Shared Infrastructure

### `src/lib/sheets.ts`

Low-level Google Sheets read, append, and update helpers.

### `src/lib/env.ts`

Environment variable access. All API keys and project config are pulled here.

### `trigger.config.ts`

Trigger.dev project config. Points to project `proj_zhwiojqebgltukvjcsiz` and task directory `./src/trigger`.

## Where Changes Should Go

- Change weekly scheduling or batch size: `src/trigger/trust-weekly-sweep.ts`
- Change per-account step order: `src/trigger/trust-process-account.ts`
- Save Firecrawl tokens or change URL targeting: `src/lib/trust-discover.ts`
- Change Firecrawl scrape options: `src/lib/trust-scrape.ts`
- Improve OpenAI judgment/output: `src/lib/trust-analyze.ts` and maybe `src/lib/trust-types.ts`
- Change Accounts sheet columns/writebacks: `src/lib/trust-seed.ts`
- Change n8n payload shape: `src/lib/trust-n8n.ts` plus the call site in `trust-process-account.ts`
- Move snapshots out of local temp storage: `src/lib/trust-snapshot.ts`
