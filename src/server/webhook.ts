import "dotenv/config";
import { serve } from "@hono/node-server";
import { tasks } from "@trigger.dev/sdk";
import { Hono } from "hono";
import { ZodError } from "zod";
import {
  companyReport,
  companyReportSchema,
} from "../trigger/companyReport.js";
import { env } from "../lib/env.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/webhooks/company-report", async (c) => {
  const provided = c.req.header("x-webhook-secret");
  if (!provided || provided !== env.webhook.secret) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  let payload;
  try {
    payload = companyReportSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return c.json({ error: "invalid_payload", issues: err.issues }, 400);
    }
    return c.json({ error: "invalid_payload" }, 400);
  }

  try {
    const handle = await tasks.trigger<typeof companyReport>(
      "generate-company-report",
      payload,
    );
    console.log(
      `[webhook] triggered run=${handle.id} company=${payload.companyName}`,
    );
    return c.json(
      {
        runId: handle.id,
        publicAccessToken: handle.publicAccessToken,
      },
      202,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] trigger failed: ${message}`);
    return c.json({ error: "trigger_failed", message }, 502);
  }
});

const port = env.webhook.port;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[webhook] listening on http://localhost:${info.port}`);
});
