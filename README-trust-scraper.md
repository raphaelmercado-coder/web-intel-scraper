# Trust Center Scraper

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env` and fill in:

```env
TRIGGER_SECRET_KEY=           # Trigger.dev prod secret key
OPENAI_API_KEY=               # OpenAI API key
FIRECRAWL_API_KEY=            # Firecrawl API key

GOOGLE_CLIENT_ID=             # Google OAuth client ID
GOOGLE_CLIENT_SECRET=         # Google OAuth client secret
GOOGLE_REDIRECT_URI=          # Google OAuth redirect URI
GOOGLE_REFRESH_TOKEN=         # Google OAuth refresh token
GOOGLE_SHEETS_SPREADSHEET_ID= # Sheet ID (from the URL)

TRUST_ACCOUNTS_RANGE=         # e.g. Accounts!A2:L1000
TRUST_N8N_WEBHOOK_URL=        # n8n webhook URL
TRUST_N8N_HMAC_SECRET=        # n8n HMAC secret (optional)
TRUST_OPENAI_MODEL=           # e.g. gpt-4o-mini
```

### 3. Make sure n8n is running

The workflow **"Trust Center Findings -> Google Sheets"** must be active in n8n before running — it receives the webhook and writes rows to the Findings tab.

### 4. Deploy to Trigger.dev (first time only)

```bash
npx trigger.dev@latest deploy
```

---

## Running a Full Sweep

### Via Trigger.dev dashboard (recommended)

1. Go to [cloud.trigger.dev](https://cloud.trigger.dev) → your project → **Tasks**
2. Select `trust-weekly-sweep`
3. Click **Trigger task**
4. Payload: `{ "run_id": "manual-001" }`
5. Hit run

### Via Claude Code (MCP)

```
trigger_task
  taskId: trust-weekly-sweep
  environment: prod
  payload: { "run_id": "manual-001" }
```

---

## Running a Single Account

Task: `trust-process-account`

Payload:
```json
{
  "account": {
    "company_name": "Acme",
    "domain": "acme.com",
    "priority_tier": "high",
    "trust_center_url": "https://trust.acme.com",
    "security_url": "",
    "has_visible_trust_center": true,
    "collector_mode": "trust_center_first",
    "industry": "SaaS",
    "segment": "",
    "known_frameworks": [],
    "last_checked_at": "",
    "notes": ""
  },
  "run_id": "manual-test",
  "run_type": "weekly"
}
```

---

## Google Sheet

**"Phase 3- Trigger Dev"** — ID: `1kQBtfBX5uJ6thm-B1KL271XFa7D2zL1sUnPvXRRAVJA`

| Tab | Purpose |
|-----|---------|
| Accounts | Input — one row per target account (cols A–L) |
| Findings | Output — one row per qualified run (cols A–Q) |

**Accounts columns (A–L):** company_name, domain, industry, segment, priority_tier, known_frameworks, last_checked_at, notes, trust_center_url, security_url, has_visible_trust_center, collector_mode

**Findings columns (A–Q):** checked_at, run_id, run_type, company_name, domain, priority_tier, confidence, frameworks_present, frameworks_missing, recent_changes, advisory_angles, rationale, source_urls, subprocessor_signal, subprocessor_notes, ai_signal, ai_notes

---

## Tasks

| Task | Description |
|------|-------------|
| `trust-weekly-sweep` | Parent — loads all accounts, runs in batches of 5 |
| `trust-daily-priority` | Same but filters to `priority_tier = high` only |
| `trust-process-account` | Per-account pipeline — discover, scrape, diff, analyze, post |

All tasks are one-off. No schedules — trigger manually from the dashboard.

---

## What It Does

For each account in the Accounts tab:

1. Discovers trust/security URLs (uses hinted URLs if set, otherwise searches the domain)
2. Scrapes pages with Firecrawl (single attempt per URL)
3. Diffs against last snapshot to detect changes
4. Analyzes with OpenAI — extracts frameworks, gaps, subprocessor posture, AI governance language, and advisory angles
5. Posts qualified findings to n8n → written to Findings tab

If a scrape fails, col H (notes) is updated with the failure reason and col K (`has_visible_trust_center`) is set to false.

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
    trust-analyze.ts           — OpenAI analysis + signal extraction
    trust-snapshot.ts          — local snapshot storage
    trust-n8n.ts               — n8n webhook post
    trust-types.ts             — shared Zod schemas and types
tools/                         — one-off local scripts
trustcenter_scraper_codemap.md — full module map with change guidance
```
