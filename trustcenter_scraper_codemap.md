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

Owns the weekly parent run. Loads all accounts, batches them, waits for child runs, runs the post-sweep Findings verification, writes a summary to `temp/outputs`, and updates `last_checked_at`. The summary includes `missing_findings: string[]` — qualified domains whose row didn't land in the sheet.

### `src/trigger/trust-daily-priority.ts`

Uses the same parent/child pattern as weekly sweep, but filters the seed list to `priority_tier === "high"`. Same Findings verification step.

### `src/trigger/trust-process-account.ts`

The main per-account orchestrator. This is where the step order lives. If the pipeline needs a new phase, this is usually where it gets inserted. Has `queue: { name: "trust-account", concurrencyLimit: 5 }` to cap global fan-out so n8n → Sheets appends don't collide on bulk triggers.

## Trust Pipeline Modules

### `src/lib/trust-seed.ts`

Google Sheets account source of truth. Reads the Accounts tab and writes back discovery hints, frameworks, `last_checked_at`, unreachable trust-center flags, and scrape failure reasons (col H `notes`). Also exposes `findMissingFindings(run_id, expectedDomains)` — read-only check against the Findings tab to detect qualified runs whose rows didn't land (used by both sweeps for post-run verification).

### `src/lib/trust-discover.ts`

URL discovery policy. This is where the hinted-URL behavior lives. Future changes about which URLs Firecrawl should touch belong here.

Current policy:

- If `trust_center_url` or `security_url` exists, return only those hinted URLs.
- Preserve `security_first` ordering when `collector_mode` is set that way.
- If no hints exist, fall back to guessed trust/security/legal paths and Firecrawl `/map`.

### `src/lib/trust-scrape.ts`

Firecrawl `/v1/scrape` calls. Single attempt per URL — no retry. Future changes about scrape format, `onlyMainContent`, or markdown extraction belong here.

### `src/lib/trust-diff.ts`

Compares current scraped pages against the previous snapshot by URL/hash and line differences.

### `src/lib/trust-analyze.ts`

OpenAI compliance analysis. Owns the analyst prompt, model call, JSON parsing, and `AnalysisSchema` validation. Extracts 4 extra signals beyond frameworks: `subprocessor_signal`, `subprocessor_notes`, `ai_signal`, `ai_notes`.

### `src/lib/trust-snapshot.ts`

Local snapshot persistence under `temp/resources/snapshots/<domain>/<YYYY-MM-DD>.json`.

### `src/lib/trust-n8n.ts`

Posts qualified findings to n8n, including optional HMAC signature. Payload includes all 4 new signal fields (`subprocessor_signal/notes`, `ai_signal/notes`).

### `src/lib/trust-types.ts`

Shared schemas and types: `Account`, `ScrapedPage`, `Snapshot`, `Analysis`, and `Result`. `AnalysisSchema` includes `subprocessor_signal`, `subprocessor_notes`, `ai_signal`, `ai_notes`.

## One-Off Tools

### `tools/add-results-headers.ts`

Writes the 4 new signal column headers (N–Q) to the Findings tab. Run once after adding fields.

### `tools/check-findings-gap.ts`

Compares Accounts vs Findings by domain and prints accounts missing a findings row. Use after a sweep to manually audit coverage outside of Trigger.dev logs.

### `tools/list-sheet-tabs.ts`

Prints all tab names from the spreadsheet. Useful for verifying tab names before scripting.

### `tools/delete-schedules.ts` / `tools/pause-schedules.ts` / `tools/inspect-schedule.ts`

Trigger.dev schedule management utilities. Run locally as needed.

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
