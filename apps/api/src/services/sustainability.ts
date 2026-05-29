import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { powerReadings, recCertificates, meters } from '../db/schema.js';
import type { Database } from '../db/client.js';

const RENEWABLE_SOURCES = new Set(['solar', 'captive-renewable', 'wind', 'hydro']);

export interface ComputeScope2Input {
  nonRenewableKWh: number;
  gridEmissionFactorGPerKwh: number;
  recOffsetKWh: number;
}

export interface ComputeScope2Result {
  scope2GrossKg: number;
  scope2NetKg: number;
  recOffsetKWh: number;
}

/** Pure function — no DB, fully unit-testable. */
export function computeScope2(input: ComputeScope2Input): ComputeScope2Result {
  const { nonRenewableKWh, gridEmissionFactorGPerKwh } = input;
  const cappedOffset = Math.min(input.recOffsetKWh, nonRenewableKWh);
  const netKWh = nonRenewableKWh - cappedOffset;

  const scope2GrossKg = Math.round((nonRenewableKWh * gridEmissionFactorGPerKwh) / 1000);
  const scope2NetKg = Math.round((netKWh * gridEmissionFactorGPerKwh) / 1000);

  return { scope2GrossKg, scope2NetKg, recOffsetKWh: cappedOffset };
}

export interface SourceKWhResult {
  renewableKWh: number;
  nonRenewableKWh: number;
  totalKWh: number;
}

/**
 * Aggregates power_readings by source for a tenant+period.
 * Returns real kWh (storage is ×1000, so we divide by 1000).
 * Sources: solar/wind/hydro/captive-renewable → renewable; everything else → non-renewable.
 * Defensive: if no readings, returns zeros (not an error).
 */
export async function aggregateSourceKWh(
  db: Database,
  tenantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SourceKWhResult> {
  const rows = await (db as any)
    .select({
      source: powerReadings.source,
      totalMilliunits: sql<number>`SUM(${powerReadings.kWh})`,
    })
    .from(powerReadings)
    .innerJoin(meters, eq(powerReadings.meterId, meters.id))
    .where(
      and(
        eq(meters.tenantId, tenantId),
        gte(powerReadings.timestamp, periodStart),
        lte(powerReadings.timestamp, periodEnd),
      ),
    )
    .groupBy(powerReadings.source)
    .all();

  let renewableKWh = 0;
  let nonRenewableKWh = 0;
  let totalKWh = 0;

  for (const row of rows) {
    const kWh = (Number(row.totalMilliunits) || 0) / 1000;
    totalKWh += kWh;
    if (RENEWABLE_SOURCES.has(row.source ?? '')) {
      renewableKWh += kWh;
    } else {
      nonRenewableKWh += kWh;
    }
  }

  return { renewableKWh, nonRenewableKWh, totalKWh };
}

/**
 * Sums active REC certificates overlapping the period.
 * Returns offset in kWh (mwh_milliunits / 1000 = MWh; MWh × 1000 = kWh → simplifies to raw value).
 */
export async function activeRecOffsetKWh(
  db: Database,
  tenantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  const rows = await (db as any)
    .select({ mwh: recCertificates.mwh })
    .from(recCertificates)
    .where(
      and(
        eq(recCertificates.tenantId, tenantId),
        eq(recCertificates.status, 'active'),
        lte(recCertificates.vintagePeriodStart, periodEnd),
        gte(recCertificates.vintagePeriodEnd, periodStart),
      ),
    )
    .all();

  // mwh_milliunits / 1000 = MWh; MWh * 1000 = kWh → mwh_milliunits = kWh
  return rows.reduce((sum: number, r: { mwh: number | null }) => sum + (r.mwh ?? 0), 0);
}
