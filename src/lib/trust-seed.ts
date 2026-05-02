import { env } from "./env.js";
import { readRange, batchUpdateCells } from "./sheets.js";
import { AccountSchema, type Account, type Result } from "./trust-types.js";

export async function loadSeedList(): Promise<Result<Account[]>> {
  try {
    const rows = await readRange(env.trust.accountsRange);
    const accounts: Account[] = [];
    for (const row of rows) {
      if (!row[0] || !row[1]) continue;
      const parsed = AccountSchema.safeParse({
        company_name: row[0] ?? "",
        domain: String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
        industry: row[2] ?? "",
        segment: row[3] ?? "",
        priority_tier: (row[4] ?? "medium").toLowerCase(),
        known_frameworks: String(row[5] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        last_checked_at: row[6] ?? "",
        notes: row[7] ?? "",
      });
      if (parsed.success) accounts.push(parsed.data);
    }
    return { ok: true, data: accounts };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateLastCheckedAt(
  domains: string[],
  isoTimestamp: string,
): Promise<Result<number>> {
  try {
    const rows = await readRange(env.trust.accountsRange);
    const tab = env.trust.accountsRange.split("!")[0] ?? "Accounts";
    const startRow = parseInt(env.trust.accountsRange.match(/!.*?(\d+)/)?.[1] ?? "2", 10);
    const targets = new Set(domains.map((d) => d.toLowerCase()));

    const updates: { range: string; value: string }[] = [];
    rows.forEach((row, i) => {
      const domain = String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (targets.has(domain)) {
        updates.push({ range: `${tab}!G${startRow + i}`, value: isoTimestamp });
      }
    });

    await batchUpdateCells(updates);
    return { ok: true, data: updates.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
