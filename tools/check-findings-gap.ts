import "dotenv/config";
import { readRange } from "../src/lib/sheets.js";

const accountsRows = await readRange("Accounts!A2:L");
const findingsRows = await readRange("Findings!A2:Q");

const accounts = accountsRows
  .filter((r) => r[0] && r[1])
  .map((r) => ({
    company: r[0],
    domain: String(r[1]).toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
  }));

const findingDomains = new Set(
  findingsRows.filter((r) => r[4]).map((r) => String(r[4]).toLowerCase().trim())
);

const missing = accounts.filter((a) => !findingDomains.has(a.domain));

console.log(`Accounts: ${accounts.length}`);
console.log(`With findings: ${findingDomains.size}`);
console.log(`Missing from findings: ${missing.length}`);
console.log("");
missing.forEach((a) => console.log(`  ${a.domain}  (${a.company})`));
