# Agent Instructions

This repo follows the WAT framework: Workflows, Agents, Tools. Let the agent handle judgment and coordination; let deterministic TypeScript modules handle execution.

## Operating Model

- Read the relevant SOP in `workflows/` before running or changing an automation. Follow the defined tool sequence, expected output shape, and edge-case guidance.
- Check `src/lib/` before building anything new. Reuse an existing helper when it fits.
- Keep credentials in `.env` only. Never commit, print, or move secrets into code.
- If something fails, read the full error, fix the underlying tool/module, verify the fix, then document the lesson in the workflow when workflow edits are allowed. Verify before re-running anything that costs meaningful time, credits, or external-service usage.
- Keep workflows current, but never create or overwrite workflow files without explicit permission.
- Ask one focused clarifying question only when the next step is genuinely ambiguous or risky.

## Project Structure

```text
workflows/        Markdown SOPs, one procedure per file
src/lib/          Shared TypeScript modules, one concern per file
src/trigger/      Trigger.dev task files
src/server/       Webhook server
temp/outputs/     Disposable generated outputs
temp/resources/   Disposable inputs and references
.env              Local secrets only
trigger.config.ts Trigger.dev project config
```

Persistent deliverables belong in cloud services such as Google Sheets, Notion, or Google Drive, not in `temp/`.

## Local Commands

- `npm run dev:trigger` - run Trigger.dev dev mode
- `npm run deploy:trigger` - deploy Trigger.dev tasks
- `npm run dev:webhook` - run webhook server in watch mode
- `npm run start:webhook` or `npm start` - run webhook server

The current Trigger config uses `dirs: ["./src/trigger"]` and a default `maxDuration` of `3600`.

## TypeScript Conventions

- This is an ESM TypeScript project. Use `.js` extensions in relative runtime imports, matching the existing files.
- Prefer Zod schemas at task/API boundaries.
- Return structured objects with stable `status`, counts, IDs, and links rather than loose strings.
- Keep edits scoped to the workflow, task, or library module involved in the request.
- Keep `src/lib/` modules deterministic and focused on one concern, such as making an API call, transforming data, reading/writing a file, or querying an external service.
- Favor consistent, testable, fast helper modules over ad hoc logic inside agents or workflows.

## Trigger.dev v4 Rules

- Always import from `@trigger.dev/sdk`.
- Never use `client.defineJob`; it is the retired v2 API.
- Use `task` for standard tasks, `schemaTask` when payload validation is needed, and `schedules.task` for cron.
- Prefer `schemaTask` for child tasks and any task receiving external or workflow-provided payloads.
- Use `logger.info`, `logger.warn`, `logger.error`, and `logger.trace` inside Trigger tasks. Avoid `console.log` in tasks.
- Access the current run ID with `ctx.run.id` inside the `run` handler.
- Throw `AbortTaskRunError` for permanent/non-retryable failures.

### Triggering

From backend/server code:

```ts
import { tasks } from "@trigger.dev/sdk";
import type { myTask } from "../trigger/myTask.js";

const handle = await tasks.trigger<typeof myTask>("my-task-id", payload);
```

From inside tasks:

```ts
const result = await childTask.triggerAndWait(payload);
if (result.ok) {
  result.output;
} else {
  result.error;
}
```

`triggerAndWait()` returns a Result object, not the direct task output. Use `result.ok` before reading `result.output`, or use `.unwrap()` when throwing on failure is desired.

`batchTriggerAndWait()` returns an object with `id` and `runs`:

```ts
const handles = await childTask.batchTriggerAndWait([
  { payload: { id: "one" } },
  { payload: { id: "two" } },
]);

for (const run of handles.runs) {
  if (run.ok) run.output;
  else run.error;
}
```

Never wrap `triggerAndWait`, `batchTriggerAndWait`, or `wait` calls in `Promise.all` or `Promise.allSettled`; Trigger.dev does not support that pattern inside tasks.

### Schedules

Use cron objects with explicit timezones:

```ts
import { schedules } from "@trigger.dev/sdk";

export const dailyTask = schedules.task({
  id: "daily-task",
  cron: { pattern: "0 13 * * *", timezone: "UTC" },
  run: async (payload, { ctx }) => {
    payload.timestamp;
    payload.timezone;
    ctx.run.id;
  },
});
```

Scheduled tasks run in dev only while the dev CLI is running. In staging/production, only tasks in the latest deployment receive schedule events.

### Batches, Debounce, and Queues

- Batch triggering supports up to 1,000 items, with payloads up to 3 MB per item.
- Use debounce for noisy user activity, webhook bursts, indexing, or notifications.
- Debounce defaults to `leading`; use `mode: "trailing"` when the latest payload should win.
- Idempotency keys take precedence over debounce settings.
- Use queues or `concurrencyKey` to protect external services and per-account workflows.

### Waits

Use `wait.for`, `wait.until`, or `wait.forToken` from `@trigger.dev/sdk` for long waits. Waits longer than 5 seconds are checkpointed and do not count toward compute usage.

## Self-Improvement Loop

1. Identify what broke.
2. Fix the tool or module.
3. Verify the fix.
4. Update the workflow when permitted.
5. Move on with a stronger system.
