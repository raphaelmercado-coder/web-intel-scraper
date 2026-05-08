import { logger, schedules } from "@trigger.dev/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { findMissingFindings, loadSeedList, updateLastCheckedAt } from "../lib/trust-seed.js";
import { trustProcessAccount, type ProcessAccountResult } from "./trust-process-account.js";

export const trustWeeklySweep = schedules.task({
  id: "trust-weekly-sweep",
  cron: { pattern: "0 13 * * 1", timezone: "UTC" },
  maxDuration: 1800,
  run: async (payload, { ctx }) => {
    const run_id = ctx.run.id;
    logger.info("weekly-sweep:start", { run_id });

    const seed = await loadSeedList();
    if (!seed.ok) {
      logger.error("weekly-sweep:seed_failed", { error: seed.error });
      return { ok: false, error: seed.error };
    }
    logger.info("weekly-sweep:seed_loaded", { count: seed.data.length });

    const BATCH_SIZE = 5;
    const results: ProcessAccountResult[] = [];
    for (let i = 0; i < seed.data.length; i += BATCH_SIZE) {
      const batch = seed.data.slice(i, i + BATCH_SIZE);
      const handles = await trustProcessAccount.batchTriggerAndWait(
        batch.map((account) => ({
          payload: { account, run_id, run_type: "weekly" as const },
          options: { concurrencyKey: account.domain },
        })),
      );
      for (const r of handles.runs) {
        results.push(r.ok ? r.output : { domain: "unknown", status: "failed" as const, qualified: false });
      }
      logger.info("weekly-sweep:batch_done", { batch: Math.floor(i / BATCH_SIZE) + 1, total_batches: Math.ceil(seed.data.length / BATCH_SIZE) });
    }

    const counts = {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      qualified: results.filter((r) => r.qualified).length,
    };

    if (counts.failed / Math.max(counts.total, 1) > 0.5) {
      logger.warn("WEEKLY_SWEEP_DEGRADED", counts);
    }
    logger.info("weekly-sweep:done", { run_id, ...counts });

    let missing_findings: string[] = [];
    const expectedDomains = results.filter((r) => r.qualified).map((r) => r.domain);
    if (expectedDomains.length > 0) {
      await new Promise((res) => setTimeout(res, 10_000));
      const verify = await findMissingFindings(run_id, expectedDomains);
      if (!verify.ok) {
        logger.warn("verify:findings_check_failed", { run_id, error: verify.error });
      } else {
        missing_findings = verify.data;
        if (missing_findings.length > 0) {
          logger.warn("VERIFY_MISSING_FINDINGS", { run_id, count: missing_findings.length, domains: missing_findings });
        } else {
          logger.info("verify:findings_complete", { run_id, qualified: expectedDomains.length });
        }
      }
    }

    const summary = { run_id, run_type: "weekly", started_at: new Date().toISOString(), ...counts, missing_findings, results };
    try {
      const outDir = path.resolve(process.cwd(), "temp/outputs");
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(path.join(outDir, `run-${run_id}.json`), JSON.stringify(summary, null, 2), "utf8");
    } catch (err) {
      logger.warn("weekly-sweep:summary_write_failed", { error: err instanceof Error ? err.message : String(err) });
    }

    const completed = results.filter((r) => r.status !== "failed").map((r) => r.domain);
    if (completed.length > 0) {
      const upd = await updateLastCheckedAt(completed, new Date().toISOString());
      if (!upd.ok) logger.warn("weekly-sweep:last_checked_update_failed", { error: upd.error });
    }

    return summary;
  },
});
