import "dotenv/config";
import { readRange } from "../src/lib/sheets.js";

async function main() {
  const rows = await readRange("Accounts!A2:L");
  rows.forEach((row) => {
    const domain = String(row[1] ?? "").padEnd(35);
    const trustUrl = String(row[8] ?? "");
    const hasVisible = String(row[10] ?? "").padEnd(8);
    const mode = String(row[11] ?? "");
    if (trustUrl) console.log(domain, "K:", hasVisible, "L:", mode);
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
