import { eq, and, gte, lt, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import type { Bindings } from '../types.js';
import { meters, powerReadings, slaConfigs, slaViolations, capacityThresholds, alerts } from '../db/schema.js';
import { aggregateByDay, fitLinearRegression, projectBreachDate } from './capacity-math.js';
import { dispatchNotifications } from './notifications.js';

/**
 * Compute uptime compliance for a meter over a period.
 * Returns bps (0–10000), capped at 10000.
 * pollingIntervalMin: expected reading interval in minutes (e.g., 15).
 */
export async function computeUptimeCompliance(
  db: Database,
  meterId: string,
  periodStart: string,
  periodEnd: string,
  pollingIntervalMin: number,
): Promise<number> {
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const hours = (endMs - startMs) / (1000 * 60 * 60);
  const expectedReadings = Math.round((hours * 60) / pollingIntervalMin);
  if (expectedReadings === 0) return 0;

  const rows = await db
    .select({ id: powerReadings.id })
    .from(powerReadings)
    .where(and(
      eq(powerReadings.meterId, meterId),
      gte(powerReadings.timestamp, periodStart),
      lt(powerReadings.timestamp, periodEnd),
    ))
    .all();

  const actualReadings = Math.min(rows.length, expectedReadings);
  return Math.round((actualReadings / expectedReadings) * 10000);
}

/**
 * Compute PUE compliance for a tenant over a period.
 * PUE = total facility kWh / IT load kWh, expressed as bps (PUE × 10000).
 * Returns null if no IT load meters or zero IT load kWh.
 */
export async function computePUECompliance(
  db: Database,
  tenantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<number | null> {
  const allMeters = await db
    .select({ id: meters.id, meterType: meters.meterType })
    .from(meters)
    .where(eq(meters.tenantId, tenantId))
    .all();

  const facilityIds = allMeters.filter((m) => m.meterType !== 'it_load').map((m) => m.id);
  const itLoadIds = allMeters.filter((m) => m.meterType === 'it_load').map((m) => m.id);

  if (itLoadIds.length === 0) return null;
  if (facilityIds.length === 0) return null;

  const facilityReadings = await db
    .select({ kWh: powerReadings.kWh })
    .from(powerReadings)
    .where(and(
      inArray(powerReadings.meterId, facilityIds),
      gte(powerReadings.timestamp, periodStart),
      lt(powerReadings.timestamp, periodEnd),
    ))
    .all();

  const itLoadReadings = await db
    .select({ kWh: powerReadings.kWh })
    .from(powerReadings)
    .where(and(
      inArray(powerReadings.meterId, itLoadIds),
      gte(powerReadings.timestamp, periodStart),
      lt(powerReadings.timestamp, periodEnd),
    ))
    .all();

  const facilityKwh = facilityReadings.reduce((s, r) => s + (r.kWh ?? 0), 0);
  const itLoadKwh = itLoadReadings.reduce((s, r) => s + (r.kWh ?? 0), 0);

  if (itLoadKwh === 0) return null;

  // PUE ratio stored as bps: PUE × 10000. Use Math.floor to match expected precision.
  return Math.floor((facilityKwh / itLoadKwh) * 10000);
}

type SLAConfigRow = {
  id: string;
  tenantId: string;
  type: string;
  targetBps: number;
  meterId: string | null;
  measurementWindow: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Check an SLA config for the given period. Creates a violation row if the
 * SLA is breached and no open violation already exists for this config+period.
 */
export async function checkSLAConfig(
  db: Database,
  config: SLAConfigRow,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  let actualBps: number | null = null;

  if (config.type === 'uptime' && config.meterId) {
    actualBps = await computeUptimeCompliance(db, config.meterId, periodStart, periodEnd, 15);
  } else if (config.type === 'pue') {
    actualBps = await computePUECompliance(db, config.tenantId, periodStart, periodEnd);
  }

  if (actualBps === null) return;
  if (actualBps >= config.targetBps) return; // SLA met

  const gap = config.targetBps - actualBps;
  const severity = gap > config.targetBps * 0.05 ? 'critical' : 'warning';

  // Idempotency: check for existing open violation for same config+period
  const existing = await db
    .select({ id: slaViolations.id })
    .from(slaViolations)
    .where(and(
      eq(slaViolations.slaConfigId, config.id),
      eq(slaViolations.periodStart, periodStart),
      eq(slaViolations.status, 'open'),
    ))
    .all();

  if (existing.length > 0) return;

  const now = new Date().toISOString();
  await db.insert(slaViolations).values({
    id: crypto.randomUUID(),
    slaConfigId: config.id,
    tenantId: config.tenantId,
    meterId: config.meterId ?? null,
    periodStart,
    periodEnd,
    targetBps: config.targetBps,
    actualBps,
    gapBps: gap,
    severity,
    status: 'open',
    createdAt: now,
  });
}

/**
 * Check capacity thresholds for a meter. Creates or updates alerts if the
 * most recent daily aggregate exceeds warning or critical values.
 */
export async function checkThresholdsForMeter(
  db: Database,
  threshold: {
    id: string;
    tenantId: string;
    meterId: string;
    metric: string;
    warningValue: number;
    criticalValue: number;
    windowDays: number;
  },
): Promise<void> {
  const readings = await db
    .select({ timestamp: powerReadings.timestamp, kWh: powerReadings.kWh, kW: powerReadings.kW })
    .from(powerReadings)
    .where(eq(powerReadings.meterId, threshold.meterId))
    .all();

  const dailyAggregates = aggregateByDay(readings);
  if (dailyAggregates.length === 0) return;

  const latest = dailyAggregates[dailyAggregates.length - 1];
  const currentValue = threshold.metric === 'kw_peak' ? latest.peakKw : latest.totalKwh;

  if (currentValue <= threshold.warningValue) return;

  const isCritical = currentValue > threshold.criticalValue;
  const alertType = isCritical ? 'capacity_critical' : 'capacity_warning';
  const severity = isCritical ? 'critical' : 'warning';

  // Compute projected breach date
  const points = dailyAggregates.map((d, i) => ({
    x: i,
    y: threshold.metric === 'kw_peak' ? d.peakKw : d.totalKwh,
  }));
  const regression = fitLinearRegression(points);
  const predictedBreachAt = projectBreachDate(regression, threshold.criticalValue, dailyAggregates[0].date);

  const now = new Date().toISOString();
  await db.insert(alerts).values({
    id: crypto.randomUUID(),
    tenantId: threshold.tenantId,
    meterId: threshold.meterId,
    slaConfigId: null,
    type: alertType,
    metric: threshold.metric,
    thresholdValue: threshold.criticalValue,
    currentValue: Math.round(currentValue),
    predictedBreachAt,
    severity,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Run all daily compliance checks. Called by the CF Cron Trigger at 00:05 UTC.
 * referenceDate defaults to now (yesterday's period is computed from it).
 */
export async function runDailyChecks(
  db: Database,
  env: Pick<Bindings, 'RESEND_API_KEY'>,
  referenceDate?: Date,
): Promise<void> {
  const ref = referenceDate ?? new Date();
  // Period = previous UTC day: midnight-to-midnight
  const refDay = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const periodEnd = refDay.toISOString();
  const prevDay = new Date(refDay.getTime() - 24 * 60 * 60 * 1000);
  const periodStart = prevDay.toISOString();

  // Process active SLA configs
  const configs = await db
    .select()
    .from(slaConfigs)
    .where(eq(slaConfigs.status, 'active'))
    .all();

  for (const config of configs) {
    await checkSLAConfig(db, config, periodStart, periodEnd);
  }

  // Process active capacity thresholds
  const thresholds = await db
    .select()
    .from(capacityThresholds)
    .where(eq(capacityThresholds.status, 'active'))
    .all();

  for (const threshold of thresholds) {
    await checkThresholdsForMeter(db, threshold);
  }

  // Dispatch notifications for new active alerts
  const newAlerts = await db
    .select()
    .from(alerts)
    .where(eq(alerts.status, 'active'))
    .all();

  for (const alert of newAlerts) {
    await dispatchNotifications(db, env, alert.tenantId, {
      event: alert.type as any,
      tenantId: alert.tenantId,
      meterId: alert.meterId,
      metric: alert.metric,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue,
      message: `${alert.type} detected for metric ${alert.metric}`,
      timestamp: alert.createdAt,
    }).catch(() => { /* best-effort: don't fail cron on notification error */ });
  }
}
