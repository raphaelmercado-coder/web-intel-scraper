import "dotenv/config";
import { readRange, batchUpdateCells } from "../src/lib/sheets.js";

const KNOWN_URLS: Record<string, string> = {
  "rippling.com": "https://trust.rippling.com",
  "ramp.com": "https://ramp.com/security",
  "anthropic.com": "https://anthropic.com/security",
  "deel.com": "https://trust.deel.com",
  "snowflake.com": "https://trust.snowflake.com",
  "moderntreasury.com": "https://trust.moderntreasury.com",
  "socure.com": "https://trust.socure.com",
  "hippocraticai.com": "https://hippocraticai.com/security",
  "freed.ai": "https://freed.ai/security",
  "ambiencehealthcare.com": "https://trust.ambience.ai",
  "suki.ai": "https://suki.ai/security",
  "headway.co": "https://trust.headway.co",
  "includedhealth.com": "https://trust.includedhealth.com",
  "modernhealth.com": "https://trust.modernhealth.com",
  "ironcladapp.com": "https://trust.ironcladapp.com",
  "relativity.com": "https://trust.relativity.com",
  "csdisco.com": "https://trust.csdisco.com",
  "servicetitan.com": "https://trust.servicetitan.com",
  "samsara.com": "https://trust.samsara.com",
  "verkada.com": "https://trust.verkada.com",
  "opengov.com": "https://trust.opengov.com",
  "granicus.com": "https://trust.granicus.com",
  "tylertech.com": "https://trust.tylertech.com",
  "catchpoint.com": "https://catchpoint.com/security",
  "drakesoftware.com": "https://drakesoftware.com/security",
  "careington.com": "https://careington.com/security",
  "cervey.com": "https://cervey.com/security",
  "gusto.com": "https://trust.gusto.com",
};

async function main() {
  const range = "Accounts!A2:L";
  const rows = await readRange(range);
  const updates: { range: string; value: string }[] = [];

  rows.forEach((row, i) => {
    const domain = String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const currentTrustUrl = String(row[8] ?? "").trim();
    const knownUrl = KNOWN_URLS[domain];
    if (knownUrl && !currentTrustUrl) {
      const rowNumber = 2 + i;
      updates.push({ range: `Accounts!I${rowNumber}`, value: knownUrl });
      console.log(`  ${domain} → ${knownUrl}`);
    }
  });

  if (updates.length === 0) {
    console.log("Nothing to update — all trust_center_url cells already have values.");
    return;
  }

  await batchUpdateCells(updates);
  console.log(`\nUpdated ${updates.length} rows.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
