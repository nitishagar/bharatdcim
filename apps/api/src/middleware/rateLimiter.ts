/**
 * In-memory sliding window rate limiter.
 * Per-isolate in Cloudflare Workers — not globally consistent across isolates.
 * Suitable for single-instance and low-traffic multi-isolate deployments.
 */

const windowMs = 60_000; // 1 minute sliding window

// Map from rate-limit key → array of request timestamps within the current window
const buckets = new Map<string, number[]>();

/**
 * Checks whether the given key has exceeded its limit.
 * Returns true if rate-limited (request should be rejected), false if allowed.
 *
 * The `now` parameter defaults to Date.now() and is exposed for unit testing
 * without requiring fake timers.
 */
export function checkLimit(key: string, limit: number, now = Date.now()): boolean {
  const cutoff = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    // Update bucket with expired timestamps removed (keep window tidy)
    buckets.set(key, timestamps);
    return true; // over limit — reject request
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return false; // within limit — allow request
}

/** Clear all rate-limit buckets. For use in tests only. */
export function clearBuckets(): void {
  buckets.clear();
}

export const AUTHENTICATED_LIMIT = 100; // requests per minute for authenticated users
export const UNAUTHENTICATED_LIMIT = 10; // requests per minute for unauthenticated

/**
 * API path prefixes that are subject to rate limiting.
 * Exported so index.ts can import instead of duplicating the constant.
 */
export const RATE_LIMITED_PREFIXES = [
  '/tariffs',
  '/meters',
  '/bills',
  '/readings',
  '/invoices',
  '/uploads',
  '/agents',
  '/dashboard',
  '/platform',
  '/racks',
  '/assets',
  '/sites',
];
