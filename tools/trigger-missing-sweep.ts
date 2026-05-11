import "dotenv/config";
import { configure, tasks } from "@trigger.dev/sdk";
import { loadSeedList } from "../src/lib/trust-seed.js";
import { readRange } from "../src/lib/sheets.js";
import { TRUST_SWEEP_BATCH_INTERVAL_MS, TRUST_SWEEP_BATCH_SIZE, trustThrottleSummary } from "../src/lib/trust-throttle.js";

configure({
  secretKey: process.env.TRIGGER_SECRET_KEY ?? "",
  baseURL: process.env.TRIGGER_API_URL ?? "https://api.trigger.dev",
});

const run_id = `targeted-${Date.now()}`;
const skipCount = Number(
  process.argv.find((arg) => arg.startsWith("--skip-count="))?.split("=")[1] ?? "0",
);
const previousRunId = process.argv.find((arg) => arg.startsWith("--previous-run-id="))?.split("=")[1] ?? "";

// Load all accounts
const seedResult = await loadSeedList();
if (!seedResult.ok) {
  console.error("Failed to load seed list:", seedResult.error);
  process.exit(1);
}

// Load findings to find which domains already have entries
const findingsRows = await readRange("Findings!A2:Q");
const findingDomains = new Set(
  findingsRows
    .filter((r) => String(r[1] ?? "") !== previousRunId)
    .filter((r) => r[4])
    .map((r) => String(r[4]).toLowerCase().trim())
);

// Filter to only accounts missing from findings
const allMissing = seedResult.data.filter(
  (a) => !findingDomains.has(a.domain.toLowerCase())
);
const missing = skipCount > 0 ? allMissing.slice(skipCount) : allMissing;

console.log(`Total accounts: ${seedResult.data.length}`);
console.log(`Already in Findings: ${findingDomains.size}`);
console.log(`Missing before resume skip: ${allMissing.length}`);
console.log(`Resume skip count: ${skipCount}`);
if (previousRunId) console.log(`Ignoring previous run rows while resuming: ${previousRunId}`);
console.log(`Missing (will trigger): ${missing.length}`);
console.log(`run_id: ${run_id}`);
console.log(`throttle: ${JSON.stringify(trustThrottleSummary())}`);
console.log("");

if (missing.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

let triggered = 0;
for (let i = 0; i < missing.length; i += TRUST_SWEEP_BATCH_SIZE) {
  const chunk = missing.slice(i, i + TRUST_SWEEP_BATCH_SIZE);
  await tasks.batchTrigger(
    "trust-process-account",
    chunk.map((account) => ({
      payload: { account, run_id, run_type: "weekly" as const },
      options: { concurrencyKey: account.domain },
    }))
  );
  triggered += chunk.length;
  const batch = Math.floor(i / TRUST_SWEEP_BATCH_SIZE) + 1;
  const total = Math.ceil(missing.length / TRUST_SWEEP_BATCH_SIZE);
  console.log(`Batch ${batch}/${total} triggered (${triggered}/${missing.length} accounts)`);
  if (i + TRUST_SWEEP_BATCH_SIZE < missing.length) {
    process.stdout.write(`  waiting ${TRUST_SWEEP_BATCH_INTERVAL_MS / 1000}s...`);
    await new Promise((res) => setTimeout(res, TRUST_SWEEP_BATCH_INTERVAL_MS));
    process.stdout.write(" go\n");
  }
}

console.log(`\nDone. ${triggered} tasks triggered with run_id=${run_id}`);
