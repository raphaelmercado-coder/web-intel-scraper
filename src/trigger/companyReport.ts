import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { buildReportDocx } from "../lib/docx.js";
import { DriveError, uploadDocx } from "../lib/drive.js";
import { env } from "../lib/env.js";
import { generateReport, OpenAIReportError } from "../lib/openai.js";

export const companyReportSchema = z.object({
  companyName: z.string().min(1),
  industry: z.string().min(1),
  goal: z.string().min(1),
  challenge: z.string().min(1),
});

export type CompanyReportPayload = z.infer<typeof companyReportSchema>;

export const companyReport = schemaTask({
  id: "generate-company-report",
  schema: companyReportSchema,
  machine: { preset: "small-2x" },
  maxDuration: 600,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (payload, { ctx }) => {
    const startedAt = Date.now();
    const runId = ctx.run.id;

    logger.info("company-report:start", {
      runId,
      companyName: payload.companyName,
      industry: payload.industry,
    });

    const content = await logger.trace("openai.generate", async (span) => {
      span.setAttribute("companyName", payload.companyName);
      try {
        const result = await generateReport(payload);
        span.setAttribute("recommendationCount", result.strategicRecommendations.length);
        span.setAttribute("riskCount", result.risks.length);
        span.setAttribute("nextStepCount", result.nextSteps.length);
        logger.info("openai.generate:ok", {
          summaryChars: result.executiveSummary.length,
          analysisChars: result.situationAnalysis.length,
          recommendations: result.strategicRecommendations.length,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("openai.generate:failed", { error: message });
        if (err instanceof OpenAIReportError && !err.retryable) {
          throw new AbortTaskRunError(`OpenAI permanent failure: ${message}`);
        }
        throw err;
      }
    });

    const buffer = await logger.trace("docx.render", async (span) => {
      try {
        const buf = await buildReportDocx(payload, content);
        span.setAttribute("bytes", buf.byteLength);
        logger.info("docx.render:ok", { bytes: buf.byteLength });
        return buf;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("docx.render:failed", { error: message });
        // Rendering is deterministic — if it fails, retrying won't help.
        throw new AbortTaskRunError(`docx render failed: ${message}`);
      }
    });

    const fileName = buildFileName(payload.companyName);

    const upload = await logger.trace("drive.upload", async (span) => {
      span.setAttribute("fileName", fileName);
      span.setAttribute("folderId", env.google.driveFolderId);
      span.setAttribute("bytes", buffer.byteLength);
      try {
        const result = await uploadDocx({
          name: fileName,
          buffer,
          folderId: env.google.driveFolderId,
        });
        span.setAttribute("fileId", result.id);
        logger.info("drive.upload:ok", {
          fileId: result.id,
          webViewLink: result.webViewLink,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("drive.upload:failed", { error: message });
        if (err instanceof DriveError && !err.retryable) {
          throw new AbortTaskRunError(`Drive permanent failure: ${message}`);
        }
        throw err;
      }
    });

    const durationMs = Date.now() - startedAt;
    logger.info("company-report:end", {
      runId,
      fileId: upload.id,
      durationMs,
    });

    return {
      status: "ok" as const,
      fileId: upload.id,
      fileName: upload.name,
      webViewLink: upload.webViewLink,
      durationMs,
    };
  },
});

function buildFileName(companyName: string): string {
  const safe = companyName.replace(/[\\/:*?"<>|]+/g, "").trim() || "Company";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safe} - Strategic Report - ${stamp}.docx`;
}
