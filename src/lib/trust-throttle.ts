// Firecrawl queue-status reported maxConcurrency=2 for this workspace.
// Use both browser slots, but keep launches paced to avoid large bursts.
export const FIRECRAWL_MAX_CONCURRENCY = 2;
export const FIRECRAWL_RESERVED_BROWSER_BUFFER = 0;

export const TRUST_ACCOUNT_QUEUE_CONCURRENCY = Math.max(
  1,
  FIRECRAWL_MAX_CONCURRENCY - FIRECRAWL_RESERVED_BROWSER_BUFFER,
);

export const TRUST_SWEEP_BATCH_SIZE = TRUST_ACCOUNT_QUEUE_CONCURRENCY;
export const TRUST_SWEEP_BATCH_INTERVAL_MS = 60_000;

export function trustThrottleSummary() {
  return {
    firecrawl_max_concurrency: FIRECRAWL_MAX_CONCURRENCY,
    reserved_browser_buffer: FIRECRAWL_RESERVED_BROWSER_BUFFER,
    account_concurrency: TRUST_ACCOUNT_QUEUE_CONCURRENCY,
    batch_size: TRUST_SWEEP_BATCH_SIZE,
    batch_interval_ms: TRUST_SWEEP_BATCH_INTERVAL_MS,
  };
}

export function waitForTrustBatchPace(batchStartedAtMs: number): Promise<void> {
  const elapsedMs = Date.now() - batchStartedAtMs;
  const remainingMs = Math.max(0, TRUST_SWEEP_BATCH_INTERVAL_MS - elapsedMs);
  return new Promise((resolve) => setTimeout(resolve, remainingMs));
}
