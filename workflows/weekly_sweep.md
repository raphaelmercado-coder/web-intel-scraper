# Workflow: Weekly Sweep

## Objective
Run the collection pipeline across **every** account in the seed list once per week and forward qualified signals to the webhook.

## Schedule
Cron `0 13 * * 1` (Mondays, 13:00 UTC). Can also be triggered manually from the Trigger.dev dashboard.

## Inputs
- Google Sheet `Accounts` tab: `company_name, domain, industry, segment, priority_tier, known_frameworks, last_checked_at, notes`.

## Steps
1. `load_seed_list` — read the entire Accounts tab into a typed `Account[]`. If the sheet read fails, abort with a logged error.
2. Batch accounts using `TRUST_SWEEP_BATCH_SIZE` (default 2), with `waitForTrustBatchPace` between batches to respect rate limits.
3. `batchTriggerAndWait` the `trust-process-account` task per batch, with `concurrencyKey = domain`.
4. Aggregate per-account results into a run summary.
5. Wait 10s, then verify output: check which qualified domains have a Findings row. Log `VERIFY_MISSING_FINDINGS` if any are absent.
6. Write the summary to `temp/outputs/run-<run_id>.json`.
7. Update `last_checked_at` in the sheet for each account that completed (status ≠ "failed").

## Failure Handling
- A failure in any single `trust-process-account` run is recorded but never fails the parent run.
- If >50% of accounts fail, emit a warning log line `WEEKLY_SWEEP_DEGRADED`.

## Output
- Run summary JSON in `temp/outputs/`.
- Qualified findings POSTed to webhook (one per qualified account).
- Updated `last_checked_at` column in the Accounts sheet.
