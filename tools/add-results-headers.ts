import "dotenv/config";
import { batchUpdateCells } from "../src/lib/sheets.js";

async function main() {
  await batchUpdateCells([
    { range: "Findings!N1", value: "subprocessor_signal" },
    { range: "Findings!O1", value: "subprocessor_notes" },
    { range: "Findings!P1", value: "ai_signal" },
    { range: "Findings!Q1", value: "ai_notes" },
  ]);
  console.log("Added columns N–Q to Results tab.");
}

main().catch((err) => { console.error(err); process.exit(1); });
