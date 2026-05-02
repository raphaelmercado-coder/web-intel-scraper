# Workflow: Weekly Sweep

## Objective
Run the trust-center collection pipeline across **every** account in the seed list once per week and forward qualified findings to n8n → Google Sheets.

## Schedule
Cron `0 13 * * 1` (Mondays, 13:00 UTC).

## Inputs
- Google Sheet `Accounts` tab, columns: `company_name, domain, industry, segment, priority_tier, known_frameworks, last_checked_at, notes`.

## Steps
1. `load_seed_list` — read the entire Accounts tab into a typed `Account[]`. If the sheet read fails, abort with a logged error; do not retry the sheet read more than 2x.
2. `batchTriggerAndWait` the `process-account` task once per account, with `concurrencyKey = domain` and a max of 5 in-flight runs.
3. Aggregate per-account results (`{ account, status: "ok"|"skipped"|"failed", qualified: boolean, error?: string }`) into a run summary.
4. Write the summary to `temp/outputs/run-<run_id>.json`.
5. Update `last_checked_at` in the sheet for each account that completed (status ≠ "failed").

## Failure handling
- A failure in any single `process-account` run is recorded but never fails the parent run.
- If >50% of accounts fail, emit a single warning log line `WEEKLY_SWEEP_DEGRADED` so the user can spot it in Trigger.dev.

## Output
- Run summary JSON in `temp/outputs/`.
- Qualified findings POSTed to n8n (one per qualified account).
- Updated `last_checked_at` column in the Accounts sheet.
