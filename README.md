# Web Intel Scraper

Async pipeline that discovers, scrapes, and analyzes target company websites — then forwards qualified signals to a webhook for downstream action.

Built on **Trigger.dev**, **Firecrawl**, and **OpenAI**. Account list lives in Google Sheets. Findings write back via n8n.

---

## Quick Ops

| I want to... | Do this |
|---|---|
| Run full sweep of all accounts | Trigger.dev dashboard → `trust-weekly-sweep` → Trigger task |
| Run high-priority accounts only | Trigger.dev dashboard → `trust-daily-priority` → Trigger task |
| Rerun one account | `npx tsx tools/trigger-single.ts <domain>` |
| Check which accounts are missing output rows | `npx tsx tools/check-findings-gap.ts` |
| Verify rows landed for a given run | Filter output sheet by `run_id` column |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
TRIGGER_PROJECT_REF=          # from Trigger.dev dashboard
TRIGGER_SECRET_KEY=           # Trigger.dev prod secret key
OPENAI_API_KEY=               # OpenAI API key
FIRECRAWL_API_KEY=            # Firecrawl API key

# Google — service account auth
GOOGLE_SERVICE_ACCOUNT_KEY_JSON=   # full JSON content of service account key (for cloud)
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=   # path to JSON key file (for local dev)
GOOGLE_SHEETS_SPREADSHEET_ID=      # Sheet ID from the URL

# Webhook delivery
N8N_TRUST_WEBHOOK_URL=        # webhook endpoint to receive findings
N8N_TRUST_WEBHOOK_SECRET=     # HMAC secret (optional)

# Pipeline config
TRUST_ACCOUNTS_RANGE=         # e.g. Accounts!A2:L
TRUST_OPENAI_MODEL=           # e.g. gpt-4o-mini
```

### 3. Deploy to Trigger.dev

```bash
npx trigger.dev@latest deploy
```

### 4. Make sure your webhook receiver is running

The pipeline POSTs findings to `N8N_TRUST_WEBHOOK_URL` after each qualified account. Your receiver should write those rows to the output sheet.

---

## Running a Sweep

### Via Trigger.dev dashboard (recommended)

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev) → your project → **Tasks**
2. Select `trust-weekly-sweep`
3. Click **Trigger task** — no payload required

### Via CLI (targeted gap-fill)

```bash
npx tsx tools/trigger-missing-sweep.ts
```

Finds accounts not yet in the output sheet and triggers them — 2 per batch, 60s between batches.

---

## Running a Single Account

```bash
npx tsx tools/trigger-single.ts acme.com
```

Or via Trigger.dev dashboard → `trust-process-account`:

```json
{
  "account": {
    "company_name": "Acme",
    "domain": "acme.com",
    "priority_tier": "medium",
    "industry": "SaaS",
    "segment": "",
    "known_frameworks": [],
    "last_checked_at": "",
    "notes": "",
    "trust_center_url": "",
    "security_url": "",
    "has_visible_trust_center": false,
    "collector_mode": "auto"
  },
  "run_id": "manual-test",
  "run_type": "weekly"
}
```

---

## Google Sheet Structure

| Tab | Purpose |
|-----|---------|
| Accounts | Input — one row per target account |
| Findings | Output — one row per qualified run |

**Accounts columns (A–L):** company_name, domain, industry, segment, priority_tier, known_frameworks, last_checked_at, notes, trust_center_url, security_url, has_visible_trust_center, collector_mode

**Findings columns (A–Q):** checked_at, run_id, run_type, company_name, domain, priority_tier, confidence, frameworks_present, frameworks_missing, recent_changes, advisory_angles, rationale, source_urls, subprocessor_signal, subprocessor_notes, ai_signal, ai_notes

---

## Tasks

| Task | Description |
|------|-------------|
| `trust-weekly-sweep` | Runs all accounts in batches, verifies output after |
| `trust-daily-priority` | Same, filtered to `priority_tier = high` |
| `trust-process-account` | Per-account pipeline — discover, scrape, diff, analyze, post |

---

## Pipeline (per account)

1. **Discover** — builds candidate URLs from domain heuristics and Firecrawl map search
2. **Scrape** — fetches page content via Firecrawl (markdown format)
3. **Diff** — compares against last snapshot to detect changes
4. **Analyze** — sends content + diff to OpenAI, returns structured signals
5. **Post** — forwards qualified findings to webhook
6. **Snapshot** — persists current state for next diff

---

## Key Files

```
src/
  trigger/
    trust-weekly-sweep.ts      — batch parent task
    trust-daily-priority.ts    — high-priority subset
    trust-process-account.ts   — per-account pipeline
  lib/
    trust-seed.ts              — reads/writes Accounts sheet
    trust-discover.ts          — URL discovery logic
    trust-scrape.ts            — Firecrawl scrape calls
    trust-diff.ts              — snapshot diffing
    trust-analyze.ts           — OpenAI analysis
    trust-snapshot.ts          — local snapshot storage
    trust-n8n.ts               — webhook post
    trust-throttle.ts          — concurrency + rate limit config
    trust-types.ts             — shared Zod schemas and types
tools/
  trigger-missing-sweep.ts     — gap-fill run (missing accounts only)
  trigger-single.ts            — single domain trigger
  check-findings-gap.ts        — audit Accounts vs Findings
codemap.md                     — full module map with change guidance
```

---

## Stack

- **Trigger.dev** — async task queue, batching, retries
- **Firecrawl** — URL discovery + page scraping
- **OpenAI** — content analysis and signal extraction
- **Google Sheets** — account list (input) + findings (output)
- **n8n** — webhook routing to downstream tools
- **TypeScript** (Node.js, tsx)
