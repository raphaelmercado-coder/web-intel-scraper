# Web Intelligence Pipeline — Codemap

## Top-Level Flow

```text
Trigger schedule / manual trigger
  trust-weekly-sweep
    -> loads Accounts sheet
    -> batches accounts (2 per batch, 60s interval)
    -> calls trust-process-account for each account
      -> discover URLs
      -> scrape pages with Firecrawl
      -> diff against last snapshot
      -> analyze with OpenAI
      -> update Accounts sheet hints/frameworks
      -> write snapshot
      -> post qualified findings to webhook
    -> writes run summary
    -> updates last_checked_at
```

## Trigger Tasks

### `src/trigger/trust-weekly-sweep.ts`

Owns the weekly parent run. Loads all accounts, batches them with throttle pacing, waits for child runs, runs post-sweep findings verification, writes a summary to `temp/outputs`, and updates `last_checked_at`. The summary includes `missing_findings: string[]` — qualified domains whose row didn't land in the output sheet.

### `src/trigger/trust-daily-priority.ts`

Uses the same parent/child pattern as weekly sweep, but filters the seed list to `priority_tier === "high"`. Same findings verification step.

### `src/trigger/trust-process-account.ts`

The main per-account orchestrator. This is where the step order lives. If the pipeline needs a new phase, this is where it gets inserted. Has `queue: { name: "trust-account", concurrencyLimit: TRUST_ACCOUNT_QUEUE_CONCURRENCY }` to cap global fan-out so webhook → Sheets appends don't collide on bulk triggers.

## Pipeline Modules

### `src/lib/trust-seed.ts`

Google Sheets account source of truth. Reads the Accounts tab and writes back discovery hints, frameworks, `last_checked_at`, unreachable flags, and scrape failure reasons (col H `notes`). Also exposes `findMissingFindings(run_id, expectedDomains)` — read-only check against the Findings tab to detect qualified runs whose rows didn't land (used by both sweeps for post-run verification).

### `src/lib/trust-discover.ts`

URL discovery policy. This is where the hinted-URL behavior lives. Future changes about which URLs Firecrawl should touch belong here.

Current policy:

- If `trust_center_url` or `security_url` exists, return only those hinted URLs.
- Preserve `security_first` ordering when `collector_mode` is set that way.
- If no hints exist, fall back to guessed paths and Firecrawl `/map`.

### `src/lib/trust-scrape.ts`

Firecrawl `/v1/scrape` calls. Single attempt per URL — no retry. Future changes about scrape format, `onlyMainContent`, or markdown extraction belong here.

### `src/lib/trust-diff.ts`

Compares current scraped pages against the previous snapshot by URL/hash and line differences.

### `src/lib/trust-analyze.ts`

OpenAI analysis. Owns the analyst prompt, model call, JSON parsing, and `AnalysisSchema` validation. Extracts signals: `subprocessor_signal`, `subprocessor_notes`, `ai_signal`, `ai_notes`, plus framework presence/absence.

### `src/lib/trust-snapshot.ts`

Local snapshot persistence under `temp/resources/snapshots/<domain>/<YYYY-MM-DD>.json`.

### `src/lib/trust-n8n.ts`

Posts qualified findings to the configured webhook, including optional HMAC signature.

### `src/lib/trust-types.ts`

Shared schemas and types: `Account`, `ScrapedPage`, `Snapshot`, `Analysis`, and `Result`. `AnalysisSchema` includes all signal fields.

## Shared Infrastructure

### `src/lib/trust-throttle.ts`

Single source of truth for all rate-limit and concurrency config. Exports `FIRECRAWL_MAX_CONCURRENCY` (2), `TRUST_ACCOUNT_QUEUE_CONCURRENCY` (2), `TRUST_SWEEP_BATCH_SIZE` (2), `TRUST_SWEEP_BATCH_INTERVAL_MS` (60s), `waitForTrustBatchPace(batchStartedAtMs)` (waits remaining interval time after a batch), and `trustThrottleSummary()` (logged at sweep start). Change Firecrawl concurrency limits here — everything else inherits automatically.

### `src/lib/sheets.ts`

Low-level Google Sheets read, append, and update helpers.

### `src/lib/env.ts`

Environment variable access. All API keys and project config are pulled here.

### `trigger.config.ts`

Trigger.dev project config. Points to `TRIGGER_PROJECT_REF` and task directory `./src/trigger`.

## One-Off Tools

### `tools/check-findings-gap.ts`

Compares Accounts vs Findings by domain and prints accounts missing an output row. Use after a sweep to audit coverage. Reads full sheet with no row cap (`Accounts!A2:L`, `Findings!A2:Q`).

### `tools/trigger-missing-sweep.ts`

Targeted sweep driver. Reads the Accounts and Findings sheets, filters to only accounts not yet in Findings, and batch-triggers `trust-process-account` for each — 2 per batch with a 60-second delay between batches. Use when you want to process only the gap without re-running already-found accounts.

### `tools/trigger-single.ts`

Triggers a single `trust-process-account` run for one domain. Usage: `npx tsx tools/trigger-single.ts <domain>`.

### `tools/add-results-headers.ts`

Writes column headers to the Findings tab. Run once on new sheet setup.

### `tools/list-sheet-tabs.ts`

Prints all tab names from the spreadsheet.

### `tools/delete-schedules.ts` / `tools/pause-schedules.ts` / `tools/inspect-schedule.ts`

Trigger.dev schedule management utilities.

## Where Changes Should Go

- Change weekly scheduling or batch size: `src/trigger/trust-weekly-sweep.ts`
- Change per-account step order: `src/trigger/trust-process-account.ts`
- Save Firecrawl tokens or change URL targeting: `src/lib/trust-discover.ts`
- Change Firecrawl scrape options: `src/lib/trust-scrape.ts`
- Improve OpenAI analysis output: `src/lib/trust-analyze.ts` and `src/lib/trust-types.ts`
- Change Accounts sheet columns/writebacks: `src/lib/trust-seed.ts`
- Change webhook payload shape: `src/lib/trust-n8n.ts` plus the call site in `trust-process-account.ts`
- Move snapshots out of local temp storage: `src/lib/trust-snapshot.ts`
- Adjust concurrency or batch pacing: `src/lib/trust-throttle.ts`
