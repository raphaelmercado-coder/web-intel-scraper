import "dotenv/config";
import { configure, tasks } from "@trigger.dev/sdk";
import { loadSeedList } from "../src/lib/trust-seed.js";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: npx tsx tools/trigger-single.ts <domain>");
  process.exit(1);
}

configure({
  secretKey: process.env.TRIGGER_SECRET_KEY ?? "",
  baseURL: process.env.TRIGGER_API_URL ?? "https://api.trigger.dev",
});

const seed = await loadSeedList();
if (!seed.ok) { console.error(seed.error); process.exit(1); }

const account = seed.data.find((a) => a.domain === domain);
if (!account) { console.error(`${domain} not found in seed list`); process.exit(1); }

console.log("Account:", JSON.stringify(account, null, 2));

const run = await tasks.trigger("trust-process-account", {
  account,
  run_id: `single-${domain}-${Date.now()}`,
  run_type: "weekly" as const,
});

console.log(`\nTriggered: ${run.id}`);
console.log(`Dashboard: https://cloud.trigger.dev/projects/v3/proj_zhwiojqebgltukvjcsiz/runs/${run.id}`);
