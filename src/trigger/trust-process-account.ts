import { AbortTaskRunError, logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { AccountSchema } from "../lib/trust-types.js";
import { discoverPages } from "../lib/trust-discover.js";
import { scrapePages } from "../lib/trust-scrape.js";
import { diffAgainstLast } from "../lib/trust-diff.js";
import { analyzePosture } from "../lib/trust-analyze.js";
import { postToN8n } from "../lib/trust-n8n.js";
import { readLatestSnapshot, writeSnapshot } from "../lib/trust-snapshot.js";
import { updateDiscoveryHints, markTrustCenterUnreachable } from "../lib/trust-seed.js";

const schema = z.object({
  account: AccountSchema,
  run_id: z.string(),
  run_type: z.enum(["weekly", "daily_priority"]),
});

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function path(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function pickDiscoveredHints(urls: string[]) {
  const trustCenterUrl = urls.find((url) => host(url).startsWith("trust.")) ??
    urls.find((url) => path(url).includes("trust"));
  const securityUrl = urls.find((url) => host(url).startsWith("security.")) ??
    urls.find((url) => path(url).includes("security"));

  return {
    trust_center_url: trustCenterUrl,
    security_url: securityUrl,
    has_visible_trust_center: Boolean(trustCenterUrl),
    collector_mode: trustCenterUrl ? ("trust_center_first" as const) : undefined,
  };
}

export const trustProcessAccount = schemaTask({
  id: "trust-process-account",
  schema,
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 2000, maxTimeoutInMs: 15000 },
  run: async (payload, { ctx }) => {
    const { account, run_id, run_type } = payload;
    const domain = account.domain;

    // 1. Discover
    const discovered = await logger.trace("discover", async (span) => {
      span.setAttribute("domain", domain);
      span.setAttribute("collector_mode", account.collector_mode);
      span.setAttribute("has_visible_trust_center", account.has_visible_trust_center);
      const result = await discoverPages(domain, 6, {
        trust_center_url: account.trust_center_url,
        security_url: account.security_url,
        has_visible_trust_center: account.has_visible_trust_center,
        collector_mode: account.collector_mode,
      });
      span.setAttribute("url_count", result.ok ? result.data.length : 0);
      return result;
    });

    if (!discovered.ok) {
      logger.error("discover:failed", { domain, error: discovered.error });
      throw new Error(discovered.error);
    }
    if (discovered.data.length === 0) {
      logger.info("discover:no_pages", { domain });
      return { domain, status: "skipped" as const, qualified: false, reason: "no_pages_found" };
    }

    const hintUpdate = await updateDiscoveryHints(domain, {
      ...pickDiscoveredHints(discovered.data),
    });
    if (!hintUpdate.ok) {
      logger.warn("discover:hints_update_failed", { domain, error: hintUpdate.error });
    } else if (hintUpdate.data > 0) {
      logger.info("discover:hints_updated", { domain, updates: hintUpdate.data });
    }

    // 2. Scrape
    let scraped = await logger.trace("scrape", async (span) => {
      span.setAttribute("url_count", discovered.data.length);
      const result = await scrapePages(discovered.data);
      if (result.ok) {
        span.setAttribute("pages_ok", result.data.pages.length);
        span.setAttribute("pages_failed", result.data.failed.length);
      }
      return result;
    });

    if (!scraped.ok) {
      logger.error("scrape:failed", { domain, error: scraped.error });
      throw new Error(scraped.error);
    }
    if (scraped.data.pages.length === 0) {
      // Retry with just the known hint URLs
      const hintUrls = [account.trust_center_url, account.security_url].filter(Boolean) as string[];
      if (hintUrls.length > 0) {
        logger.info("scrape:retry_hints", { domain, urls: hintUrls });
        const retried = await scrapePages(hintUrls, { waitFor: 5000 });
        if (retried.ok && retried.data.pages.length > 0) {
          scraped = { ok: true, data: retried.data };
        }
      }
    }

    if (scraped.data.pages.length === 0) {
      logger.info("scrape:all_failed", { domain, failed: scraped.data.failed });
      metadata.set("scrape_failed", true);
      const unreachable = await markTrustCenterUnreachable(domain);
      if (!unreachable.ok) {
        logger.warn("scrape:mark_unreachable_failed", { domain, error: unreachable.error });
      } else {
        logger.info("scrape:marked_unreachable", { domain });
      }
      return { domain, status: "skipped" as const, qualified: false, reason: "all_scrapes_failed" };
    }

    // 3. Diff
    const lastResult = await readLatestSnapshot(domain);
    const lastSnap = lastResult.ok ? lastResult.data : null;
    const diff = diffAgainstLast(scraped.data.pages, lastSnap);
    if (!diff.ok) {
      logger.error("diff:failed", { domain, error: diff.error });
      throw new Error(diff.error);
    }
    logger.info("diff:ok", {
      domain,
      changed: diff.data.changed_urls.length,
      new_urls: diff.data.new_urls.length,
      removed: diff.data.removed_urls.length,
    });

    // 4. Analyze
    const analysis = await logger.trace("analyze", async (span) => {
      span.setAttribute("domain", domain);
      const result = await analyzePosture(account, scraped.data.pages, diff.data);
      if (result.ok) {
        span.setAttribute("qualified", result.data.qualified);
        span.setAttribute("confidence", result.data.confidence);
      }
      return result;
    });

    if (!analysis.ok) {
      if (analysis.error.startsWith("analysis_schema_invalid")) {
        throw new AbortTaskRunError(`Analysis schema invalid for ${domain}: ${analysis.error}`);
      }
      logger.error("analyze:failed", { domain, error: analysis.error });
      throw new Error(analysis.error);
    }

    // 5a. Write frameworks back to Accounts sheet
    if (analysis.data.frameworks_present.length > 0) {
      const fwUpdate = await updateDiscoveryHints(domain, {
        frameworks_present: analysis.data.frameworks_present,
      });
      if (!fwUpdate.ok) {
        logger.warn("frameworks:update_failed", { domain, error: fwUpdate.error });
      } else if (fwUpdate.data > 0) {
        logger.info("frameworks:updated", { domain, added: analysis.data.frameworks_present });
      }
    }

    // 5. Persist snapshot
    const saved = await writeSnapshot({
      domain,
      taken_at: new Date().toISOString(),
      resolved_urls: discovered.data,
      pages: scraped.data.pages,
      analysis: analysis.data,
    });
    if (!saved.ok) logger.warn("snapshot:write_failed", { domain, error: saved.error });

    // 6. Post to n8n if qualified
    if (analysis.data.qualified) {
      const post = await logger.trace("post_n8n", async (span) => {
        span.setAttribute("domain", domain);
        return postToN8n({
          run_id,
          run_type,
          company_name: account.company_name,
          domain,
          priority_tier: account.priority_tier,
          frameworks_present: analysis.data.frameworks_present,
          frameworks_missing: analysis.data.frameworks_missing,
          recent_changes: analysis.data.recent_changes,
          advisory_angles: analysis.data.advisory_angles,
          confidence: analysis.data.confidence,
          rationale: analysis.data.rationale,
          checked_at: new Date().toISOString(),
          source_urls: scraped.data.pages.map((p) => p.url),
        });
      });
      if (!post.ok) {
        logger.error("post_n8n:failed", { domain, error: post.error });
        throw new Error(post.error);
      }
    }

    logger.info("process-account:done", {
      domain,
      qualified: analysis.data.qualified,
      confidence: analysis.data.confidence,
      run_id: ctx.run.id,
    });

    return { domain, status: "ok" as const, qualified: analysis.data.qualified };
  },
});

export type ProcessAccountResult =
  | { domain: string; status: "ok"; qualified: boolean }
  | { domain: string; status: "skipped"; qualified: boolean; reason: string }
  | { domain: string; status: "failed"; qualified: false; error?: string };
