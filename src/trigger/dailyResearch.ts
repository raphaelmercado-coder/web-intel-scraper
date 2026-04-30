import { logger, schedules } from "@trigger.dev/sdk";
import {
  FIRECRAWL_RESULT_LIMIT,
  RESEARCH_TOPIC,
} from "../lib/config.js";
import { searchTopic, type FirecrawlHit } from "../lib/firecrawl.js";
import {
  fallbackSynthesis,
  synthesize,
  type Synthesis,
} from "../lib/synthesize.js";
import { appendRow } from "../lib/sheets.js";

export const dailyResearch = schedules.task({
  id: "daily-research",
  cron: { pattern: "0 13 * * *", timezone: "America/New_York" },
  machine: { preset: "medium-1x" },
  retry: { maxAttempts: 1 },
  run: async (payload, { ctx }) => {
    const startedAt = Date.now();
    const runId = ctx.run.id;
    const topicOverride = (payload as { topic?: string }).topic;
    const topic = topicOverride ?? RESEARCH_TOPIC;

    const scheduledAt = payload.timestamp ?? new Date();
    logger.info("daily-research:start", {
      topic,
      runId,
      scheduledAt: scheduledAt.toISOString(),
      timezone: payload.timezone ?? "UTC",
    });

    let hits: FirecrawlHit[] = [];
    try {
      hits = await logger.trace("firecrawl.search", async (span) => {
        span.setAttribute("topic", topic);
        span.setAttribute("limit", FIRECRAWL_RESULT_LIMIT);
        const result = await searchTopic(topic, FIRECRAWL_RESULT_LIMIT);
        span.setAttribute("hits", result.length);
        return result;
      });
      logger.info("firecrawl.search:ok", { hitCount: hits.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("firecrawl.search:failed", { error: message });
      await safeAppend([
        new Date().toISOString(),
        topic,
        "SEARCH_FAILED",
        message,
        "",
        runId,
      ]);
      return { status: "search_failed", durationMs: Date.now() - startedAt };
    }

    let synthesis: Synthesis;
    try {
      synthesis = await logger.trace("llm.synthesize", async (span) => {
        span.setAttribute("topic", topic);
        span.setAttribute("hitCount", hits.length);
        const result = await synthesize(topic, hits);
        span.setAttribute("summaryChars", result.summary.length);
        span.setAttribute("keyPointCount", result.keyPoints.length);
        return result;
      });
      logger.info("llm.synthesize:ok", {
        summaryChars: synthesis.summary.length,
        keyPointCount: synthesis.keyPoints.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("llm.synthesize:failed", { error: message });
      synthesis = fallbackSynthesis(topic, hits);
    }

    const sourceUrls = synthesis.sources.length
      ? synthesis.sources
      : hits.map((h) => h.url).filter(Boolean);

    const appended = await safeAppend([
      new Date().toISOString(),
      topic,
      synthesis.summary,
      synthesis.keyPoints.join(" • "),
      sourceUrls.join("\n"),
      runId,
    ]);

    const durationMs = Date.now() - startedAt;
    logger.info("daily-research:end", {
      rowsWritten: appended ? 1 : 0,
      durationMs,
    });

    return {
      status: appended ? "ok" : "sheet_failed",
      rowsWritten: appended ? 1 : 0,
      durationMs,
    };
  },
});

async function safeAppend(values: (string | number)[]): Promise<boolean> {
  try {
    return await logger.trace("sheets.append", async (span) => {
      span.setAttribute("columnCount", values.length);
      const { updatedRange } = await appendRow(values);
      span.setAttribute("updatedRange", updatedRange ?? "");
      logger.info("sheets.append:ok", { updatedRange });
      return true;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("sheets.append:failed", { error: message });
    return false;
  }
}
