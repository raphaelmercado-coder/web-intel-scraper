import { logger, schedules } from "@trigger.dev/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadSeedList, updateLastCheckedAt } from "../lib/trust-seed.js";
import { trustProcessAccount, type ProcessAccountResult } from "./trust-process-account.js";

export const trustDailyPriority = schedules.task({
  id: "trust-daily-priority",
  cron: { pattern: "0 13 * * *", timezone: "UTC" },
  maxDuration: 900,
  run: async (payload, { ctx }) => {
    const run_id = ctx.run.id;

    const seed = await loadSeedList();
    if (!seed.ok) {
      logger.error("daily-priority:seed_failed", { error: seed.error });
      return { ok: false, error: seed.error };
    }

    const targets = seed.data.filter((a) => a.priority_tier === "high");
    if (targets.length === 0) {
      logger.info("DAILY_PRIORITY_NOOP", { run_id });
      return { run_id, run_type: "daily_priority", total: 0, ok: 0, skipped: 0, failed: 0, qualified: 0, results: [] };
    }
    logger.info("daily-priority:start", { run_id, count: targets.length });

    const handles = await trustProcessAccount.batchTriggerAndWait(
      targets.map((account) => ({
        payload: { account, run_id, run_type: "daily_priority" as const },
        options: { concurrencyKey: account.domain },
      })),
    );

    const results: ProcessAccountResult[] = handles.runs.map((r) =>
      r.ok ? r.output : { domain: "unknown", status: "failed" as const, qualified: false },
    );

    const counts = {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      qualified: results.filter((r) => r.qualified).length,
    };
    logger.info("daily-priority:done", { run_id, ...counts });

    const summary = { run_id, run_type: "daily_priority", started_at: new Date().toISOString(), ...counts, results };
    try {
      const outDir = path.resolve(process.cwd(), "temp/outputs");
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(path.join(outDir, `run-${run_id}.json`), JSON.stringify(summary, null, 2), "utf8");
    } catch (err) {
      logger.warn("daily-priority:summary_write_failed", { error: err instanceof Error ? err.message : String(err) });
    }

    const completed = results.filter((r) => r.status !== "failed").map((r) => r.domain);
    if (completed.length > 0) {
      const upd = await updateLastCheckedAt(completed, new Date().toISOString());
      if (!upd.ok) logger.warn("daily-priority:last_checked_update_failed", { error: upd.error });
    }

    return summary;
  },
});
