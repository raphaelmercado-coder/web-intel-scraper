# Agent Instructions

You're working inside the WAT framework — **Workflows, Agents, Tools** — a system built on one core idea: let probabilistic AI handle reasoning and judgment, let deterministic code handle execution. That separation is what makes agentic systems reliable, repeatable, and actually useful in production rather than just impressive in demos.

---

## Layer 1: Workflows (The Instructions)

Markdown SOPs live in `workflows/`. Each file defines a single procedure: the objective, required inputs, which tools to call, what the expected output looks like, and how to handle edge cases. Written in plain language so the agent can read and act without ambiguity.

---

## Layer 2: Agents (The Decision-Maker)

That's you — Claude Code. Your role is to coordinate intelligently. Read the relevant workflow first. Run the tools in the defined sequence. Handle failures without panicking. If something is genuinely ambiguous, ask one focused clarifying question before proceeding. You don't try to do everything directly — you connect intent to execution and stay out of the way.

---

## Layer 3: Tools (The Execution)

TypeScript modules in `src/lib/`. Each module does one thing: make an API call, transform data, read or write a file, query an external service. Credentials stay in `.env` and nowhere else. Modules are consistent, testable, and fast.

---

## How to Operate

1. **Check `src/lib/` before building anything new.** Reuse what exists. Build only when nothing fits.
2. **Learn and adapt when things fail.** Read the full error. Fix the module. Document the lesson in the workflow. Verify the fix before re-running anything that costs time or credits.
3. **Keep workflows current but never create or overwrite them without permission.**

---

## Self-Improvement Loop

1. Identify what broke
2. Fix the tool
3. Verify the fix
4. Update the workflow
5. Move on with a stronger system

---

## File Structure

```
workflows/        — markdown SOPs, one file per procedure
src/
  lib/            — shared modules, one concern per file
  trigger/        — Trigger.dev task files
  server/         — webhook server
temp/
  outputs/        — generated results (disposable)
  resources/      — input files and references (disposable)
.env              — secrets (never commit, never share)
```

Deliverables that need to persist live in cloud services — Google Sheets, Notion, Google Drive — not in `temp/`.

---

## Trigger.dev Rules (v4)

**Imports:** always `@trigger.dev/sdk`. Never `client.defineJob` (v2, retired).

**Task types:**
- `task` — standard task
- `schemaTask` — use when payload needs Zod validation (preferred for child tasks)
- `schedules.task` — for cron; use `cron: { pattern: "...", timezone: "..." }`

**Logging:** use `logger.info / .warn / .error / .trace` from `@trigger.dev/sdk`, not `console.log`.

**Non-retryable errors:** throw `AbortTaskRunError` to skip remaining retry attempts.

**`batchTriggerAndWait` result shape:**
```ts
const handles = await myTask.batchTriggerAndWait([...]);
for (const r of handles.runs) {
  if (r.ok) r.output; // task return value
  else r.error;
}
```

**Never** wrap `triggerAndWait` or `batchTriggerAndWait` in `Promise.all` — not supported.

**Run context:** access run ID via `ctx.run.id` inside the `run` handler, not from payload.
