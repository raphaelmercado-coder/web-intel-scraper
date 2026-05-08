import { schedules } from "@trigger.dev/sdk/v3";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const list = await schedules.list();

  if (list.data.length === 0) {
    console.log("No schedules found.");
    return;
  }

  console.log(`Deleting ${list.data.length} schedule(s)...\n`);
  for (const s of list.data) {
    await schedules.del(s.id);
    console.log(`  ✓ deleted ${s.task}  (${s.id})`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
