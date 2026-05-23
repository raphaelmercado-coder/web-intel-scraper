# Web Intel Scraper

Discovers, scrapes, and analyzes target company websites on a schedule. Forwards qualified signals to a webhook for downstream routing.

**Built for B2B compliance and cybersecurity prospecting.** Surfaces buying-window signals (audit renewals, framework adoption, trust-center updates) that conventional lead lists miss.

> Read the case study: **[raphaelmercado.dev/work/lead-gen](https://raphaelmercado.dev/work/lead-gen)**. Why it runs as expeditions, not a cron, and why the intake is the real product.

---

## Pipeline (per account)

1. **Discover** — candidate URLs from domain heuristics + Firecrawl map search
2. **Scrape** — page content via Firecrawl
3. **Diff** — compare against last snapshot
4. **Analyze** — OpenAI returns structured signals
5. **Post** — webhook if qualified
6. **Snapshot** — persist for next diff

---

## What You Need

| Artifact | Where |
|---|---|
| **Google Sheet** | Two tabs: `Accounts` (input) and `Findings` (output). Column layout below. |
| **Trigger.dev project** | [cloud.trigger.dev](https://cloud.trigger.dev) — free tier works |
| **Firecrawl API key** | [firecrawl.dev](https://firecrawl.dev) |
| **OpenAI API key** | [platform.openai.com](https://platform.openai.com) |
| **Google service account** | GCP console → IAM → Service Accounts → JSON key, with Sheets access granted |
| **Webhook receiver** | n8n, Make, or any HTTP endpoint that writes rows to your Findings sheet |

---

## What To Do

```bash
# 1. Install
npm install

# 2. Fill in credentials
cp .env.example .env
# edit .env — see required keys below

# 3. Deploy tasks to Trigger.dev
npx trigger.dev@latest deploy

# 4. Trigger a sweep
# → Trigger.dev dashboard → Tasks → trust-weekly-sweep → Trigger task
```

Accounts are read from the sheet, scraped, analyzed, and qualified findings are POSTed to your webhook.

---

## .env Keys

```env
TRIGGER_PROJECT_REF=          # Trigger.dev dashboard → Project Settings
TRIGGER_SECRET_KEY=           # Trigger.dev → API Keys (prod)
OPENAI_API_KEY=
FIRECRAWL_API_KEY=

GOOGLE_SERVICE_ACCOUNT_KEY_JSON=   # full JSON (for cloud workers)
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=   # file path (for local dev)
GOOGLE_SHEETS_SPREADSHEET_ID=      # from the sheet URL

N8N_TRUST_WEBHOOK_URL=        # your webhook endpoint
N8N_TRUST_WEBHOOK_SECRET=     # HMAC secret (optional)

TRUST_ACCOUNTS_RANGE=Accounts!A2:L
TRUST_OPENAI_MODEL=gpt-4o-mini
```

---

## Google Sheet Structure

**Accounts tab (input), columns A–L:**
`company_name, domain, industry, segment, priority_tier, known_frameworks, last_checked_at, notes, trust_center_url, security_url, has_visible_trust_center, collector_mode`

**Findings tab (output), columns A–Q:**
`checked_at, run_id, run_type, company_name, domain, priority_tier, confidence, frameworks_present, frameworks_missing, recent_changes, advisory_angles, rationale, source_urls, subprocessor_signal, subprocessor_notes, ai_signal, ai_notes`

---

## Tasks

| Task | What it does |
|---|---|
| `trust-weekly-sweep` | Full sweep of every account, batched, with output verification |
| `trust-daily-priority` | Same, filtered to `priority_tier = high` |
| `trust-process-account` | Single-account pipeline: discover → scrape → diff → analyze → post |

---

## Operator scripts

```bash
npx tsx tools/trigger-single.ts acme.com      # rerun one domain
npx tsx tools/trigger-missing-sweep.ts        # trigger only accounts not in Findings yet
npx tsx tools/check-findings-gap.ts           # audit Accounts vs Findings
```

---

## Stack

- **Trigger.dev** — task queue, batching, retries
- **Firecrawl** — URL discovery + scraping
- **OpenAI** — analysis + signal extraction
- **Google Sheets** — account list + findings
- **n8n** (or any webhook) — downstream routing

---

*The build was always the easy part. The intake is the work.*
