# Workflow: Daily Priority Check

## Objective
Run the pipeline only against accounts marked `priority_tier = "high"` to catch trust-center changes faster than the weekly cadence allows.

## Schedule
Cron `0 13 * * *` (every day, 13:00 UTC).

## Inputs
Same as Weekly Sweep, filtered to `priority_tier === "high"`.

## Steps
1. `load_seed_list` → filter to high-priority accounts.
2. If the filtered list is empty, log `DAILY_PRIORITY_NOOP` and exit cleanly.
3. `batchTriggerAndWait` `process-account` per account, concurrency 5.
4. Tag the n8n payload with `run_type: "daily_priority"` so the Sheets row routes correctly (or is dedup-able).
5. Write run summary to `temp/outputs/run-<run_id>.json`.

## Failure handling
Identical to Weekly Sweep.

## Notes
- Daily runs are expected to produce mostly empty diffs. Only **changes** or **newly-detected gaps** should qualify and forward to n8n; otherwise the run is a quiet success.
