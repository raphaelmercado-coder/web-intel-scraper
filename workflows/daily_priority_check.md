# Workflow: Daily Priority Check

## Objective
Run the pipeline only against accounts marked `priority_tier = "high"` to catch changes faster than the weekly cadence allows.

## Schedule
Cron `0 13 * * *` (every day, 13:00 UTC). Can also be triggered manually.

## Inputs
Same as Weekly Sweep, filtered to `priority_tier === "high"`.

## Steps
1. `load_seed_list` → filter to high-priority accounts.
2. If the filtered list is empty, log `DAILY_PRIORITY_NOOP` and exit cleanly.
3. Batch and `batchTriggerAndWait` `trust-process-account` per account using throttle config.
4. Tag the webhook payload with `run_type: "daily_priority"` for downstream routing.
5. Write run summary to `temp/outputs/run-<run_id>.json`.

## Failure Handling
Identical to Weekly Sweep.

## Notes
- Daily runs are expected to produce mostly empty diffs. Only **changes** or **newly-detected signals** should qualify and post to the webhook.
