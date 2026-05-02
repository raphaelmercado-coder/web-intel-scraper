import { promises as fs } from "node:fs";
import path from "node:path";
import type { Snapshot, Result } from "./trust-types.js";

const ROOT = path.resolve(process.cwd(), "temp/resources/snapshots");

function dir(domain: string) {
  return path.join(ROOT, domain.replace(/[^a-z0-9.-]/gi, "_"));
}

export async function writeSnapshot(snap: Snapshot): Promise<Result<string>> {
  try {
    const d = dir(snap.domain);
    await fs.mkdir(d, { recursive: true });
    const file = path.join(d, `${snap.taken_at.slice(0, 10)}.json`);
    await fs.writeFile(file, JSON.stringify(snap, null, 2), "utf8");
    return { ok: true, data: file };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function readLatestSnapshot(domain: string): Promise<Result<Snapshot | null>> {
  try {
    const d = dir(domain);
    let entries: string[];
    try {
      entries = await fs.readdir(d);
    } catch {
      return { ok: true, data: null };
    }
    const dated = entries.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    if (dated.length === 0) return { ok: true, data: null };
    const raw = await fs.readFile(path.join(d, dated[dated.length - 1]), "utf8");
    return { ok: true, data: JSON.parse(raw) as Snapshot };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
