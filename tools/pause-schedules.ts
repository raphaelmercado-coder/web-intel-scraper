import { schedules } from "@trigger.dev/sdk/v3";
import * as dotenv from "dotenv";
dotenv.config();

const ENV = (process.argv[2] ?? "prod") as "prod" | "dev";

async function main() {
  const list = await schedules.list();
  const active = list.data.filter((s) => s.active);

  if (active.length === 0) {
    console.log("No active schedules found.");
    return;
  }

  console.log(`Found ${active.length} active schedule(s):\n`);
  for (const s of active) {
    console.log(`  ${s.task}  id=${s.id}  cron=${s.generator?.expression ?? JSON.stringify(s.generator)}`);
  }

  console.log(`\nDeactivating all on ${ENV}...`);
  for (const s of active) {
    await schedules.deactivate(s.id);
    console.log(`  ✓ deactivated ${s.taskIdentifier} (${s.id})`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
