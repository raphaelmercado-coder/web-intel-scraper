import { env } from "./env.js";
import { readRange, batchUpdateCells } from "./sheets.js";
import { AccountSchema, type Account, type Result } from "./trust-types.js";

type DiscoveryHintsUpdate = {
  trust_center_url?: string;
  security_url?: string;
  has_visible_trust_center?: boolean;
  collector_mode?: Account["collector_mode"];
  frameworks_present?: string[];
};

function parseFrameworks(cell: string): string[] {
  return cell
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^to verify$/i.test(s));
}

function parseBoolean(cell: string): boolean {
  return /^(true|yes|y|1)$/i.test(cell.trim());
}

function accountsRange(): string {
  return env.trust.accountsRange
    .replace(/!([A-Z]+)(\d+):[A-Z]+$/i, "!$1$2:L")
    .replace(/(\![A-Z]+\d+:[A-Z]+)$/i, "$11000");
}

export async function loadSeedList(): Promise<Result<Account[]>> {
  try {
    const rows = await readRange(accountsRange());
    const accounts: Account[] = [];
    for (const row of rows) {
      if (!row[0] || !row[1]) continue;
      const parsed = AccountSchema.safeParse({
        company_name: row[0] ?? "",
        domain: String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
        industry: row[2] ?? "",
        segment: row[3] ?? "",
        priority_tier: (row[4] || "medium").toLowerCase(),
        known_frameworks: parseFrameworks(String(row[5] ?? "")),
        last_checked_at: row[6] ?? "",
        notes: row[7] ?? "",
        trust_center_url: row[8] ?? "",
        security_url: row[9] ?? "",
        has_visible_trust_center: parseBoolean(row[10] ?? ""),
        collector_mode: (row[11] || "auto").toLowerCase(),
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
    const range = accountsRange();
    const rows = await readRange(range);
    const tab = range.split("!")[0] ?? "Accounts";
    const startRow = parseInt(range.match(/!.*?(\d+)/)?.[1] ?? "2", 10);
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

export async function markTrustCenterUnreachable(domain: string, reason?: string): Promise<Result<number>> {
  try {
    const range = accountsRange();
    const rows = await readRange(range);
    const tab = range.split("!")[0] ?? "Accounts";
    const startRow = parseInt(range.match(/!.*?(\d+)/)?.[1] ?? "2", 10);
    const target = domain.toLowerCase();

    const updates: { range: string; value: string }[] = [];
    rows.forEach((row, i) => {
      const rowDomain = String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (rowDomain !== target) return;
      const rowNumber = startRow + i;
      updates.push({ range: `${tab}!K${rowNumber}`, value: "false" });
      if (reason) {
        const note = `[scrape_failed @ ${new Date().toISOString().slice(0, 10)}: ${reason}]`;
        updates.push({ range: `${tab}!H${rowNumber}`, value: note });
      }
    });

    await batchUpdateCells(updates);
    return { ok: true, data: updates.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateDiscoveryHints(
  domain: string,
  hints: DiscoveryHintsUpdate,
): Promise<Result<number>> {
  try {
    const range = accountsRange();
    const rows = await readRange(range);
    const tab = range.split("!")[0] ?? "Accounts";
    const startRow = parseInt(range.match(/!.*?(\d+)/)?.[1] ?? "2", 10);
    const target = domain.toLowerCase();

    const updates: { range: string; value: string }[] = [];
    rows.forEach((row, i) => {
      const rowDomain = String(row[1] ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (rowDomain !== target) return;

      const rowNumber = startRow + i;
      const currentTrustUrl = String(row[8] ?? "");
      const currentSecurityUrl = String(row[9] ?? "");
      const currentMode = String(row[11] ?? "auto").toLowerCase();

      if (hints.trust_center_url && !currentTrustUrl) {
        updates.push({ range: `${tab}!I${rowNumber}`, value: hints.trust_center_url });
      }
      if (hints.security_url && !currentSecurityUrl) {
        updates.push({ range: `${tab}!J${rowNumber}`, value: hints.security_url });
      }
      if (hints.has_visible_trust_center !== undefined && !parseBoolean(String(row[10] ?? ""))) {
        updates.push({ range: `${tab}!K${rowNumber}`, value: hints.has_visible_trust_center ? "true" : "false" });
      }
      if (hints.collector_mode && (!currentMode || currentMode === "auto")) {
        updates.push({ range: `${tab}!L${rowNumber}`, value: hints.collector_mode });
      }
      if (hints.frameworks_present && hints.frameworks_present.length > 0) {
        const existing = new Set(parseFrameworks(String(row[5] ?? "")).map((f) => f.toLowerCase()));
        const toAdd = hints.frameworks_present.filter((f) => !existing.has(f.toLowerCase()));
        if (toAdd.length > 0) {
          const merged = [...parseFrameworks(String(row[5] ?? "")), ...toAdd].join("; ");
          updates.push({ range: `${tab}!F${rowNumber}`, value: merged });
        }
      }
    });

    await batchUpdateCells(updates);
    return { ok: true, data: updates.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
