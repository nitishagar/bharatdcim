/**
 * Calculate billed demand based on contracted demand, recorded demand,
 * and state-specific ratchet rules.
 *
 * Returns the higher of:
 * - Actual recorded demand
 * - Contracted demand × ratchet percentage
 * - Minimum demand (if applicable)
 */
export function calculateBilledDemand(
  contractedKVA: number,
  recordedKVA: number,
  ratchetPercent: number,
  minimumKVA: number,
): number {
  return Math.max(
    recordedKVA,
    (contractedKVA * ratchetPercent) / 100,
    minimumKVA,
  );
}
