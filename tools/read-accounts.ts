import "dotenv/config";
import { readRange } from "../src/lib/sheets.js";

const TARGETS = ["rippling.com", "deel.com", "snowflake.com", "samsara.com", "ironcladapp.com"];

async function main() {
  const rows = await readRange("Accounts!A2:L");
  const results: Record<string, string[]> = {};
  rows.forEach((row) => {
    const domain = String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (TARGETS.includes(domain)) results[domain] = row;
  });
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
