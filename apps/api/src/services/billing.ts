import {
  calculateBill,
  classifyReading,
} from '@bharatdcim/billing-engine';
import type { TariffConfig, ClassifiedReading, BillOutput, PowerSourceInput } from '@bharatdcim/billing-engine';
import { eq, and, gte, lte, gt, or, isNull } from 'drizzle-orm';
import { powerReadings, tariffConfigs, meters, bills } from '../db/schema.js';
import type { Database } from '../db/client.js';

export interface CalculateBillParams {
  meterId: string;
  tenantId: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
  contractedDemandKVA: number;
  recordedDemandKVA: number;
  powerFactor: number; // 0.0-1.0
  dgKWh?: number;
  dgRatePaisa?: number;
}

export interface CalculateBillResult {
  bill: BillOutput;
  billId: string;
  tariffId: string;
  readingCount: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function selectTariffForPeriod(
  db: Database,
  meter: { tariffId: string; tenantId: string; stateCode: string },
  periodStart: string,
): Promise<typeof tariffConfigs.$inferSelect> {
  const bound = (await db.select().from(tariffConfigs).where(eq(tariffConfigs.id, meter.tariffId)).all())[0];
  if (!bound) throw new Error(`Tariff ${meter.tariffId} not found`);
  const lineageKey = bound.lineageKey;
  if (!lineageKey) return bound;
  const versions = await db.select().from(tariffConfigs)
    .where(and(
      eq(tariffConfigs.lineageKey, lineageKey),
      lte(tariffConfigs.effectiveFrom, periodStart),
      or(isNull(tariffConfigs.effectiveTo), gt(tariffConfigs.effectiveTo, periodStart)),
    )).all();
  if (versions.length === 0) {
    throw new Error(`No tariff version effective for period starting ${periodStart} (lineage ${lineageKey})`);
  }
  return versions.sort((a, b) => b.version - a.version)[0];
}

/**
 * Orchestrates the full billing flow:
 * 1. Look up meter → tariff config
 * 2. Fetch readings for the period
 * 3. Classify readings by ToD
 * 4. Calculate the bill
 * 5. Store in DB
 */
export async function calculateAndStoreBill(
  params: CalculateBillParams,
  db: Database,
): Promise<CalculateBillResult> {
  // 1. Look up meter and its tariff
  const meterRows = await db.select().from(meters).where(eq(meters.id, params.meterId)).all();
  if (meterRows.length === 0) {
    throw new Error(`Meter ${params.meterId} not found`);
  }
  const meter = meterRows[0];

  if (!meter.tariffId) {
    throw new Error(`Meter ${params.meterId} has no tariff configured`);
  }

  const tariffRow = await selectTariffForPeriod(
    db,
    { tariffId: meter.tariffId, tenantId: meter.tenantId, stateCode: meter.stateCode },
    params.periodStart,
  );

  // Reconstruct TariffConfig from DB row
  const tariff: TariffConfig = {
    id: tariffRow.id,
    stateCode: tariffRow.stateCode,
    discom: tariffRow.discom,
    category: tariffRow.category,
    effectiveFrom: tariffRow.effectiveFrom,
    effectiveTo: tariffRow.effectiveTo,
    billingUnit: tariffRow.billingUnit as 'kWh' | 'kVAh',
    baseEnergyRatePaisa: tariffRow.baseEnergyRatePaisa,
    wheelingChargePaisa: tariffRow.wheelingChargePaisa,
    demandChargePerKVAPaisa: tariffRow.demandChargePerKvaPaisa,
    demandRatchetPercent: tariffRow.demandRatchetPercent,
    minimumDemandKVA: tariffRow.minimumDemandKva,
    timeSlots: JSON.parse(tariffRow.timeSlotsJson),
    fuelAdjustmentPaisa: tariffRow.fuelAdjustmentPaisa,
    fuelAdjustmentType: tariffRow.fuelAdjustmentType as 'absolute' | 'percentage',
    electricityDutyBps: tariffRow.electricityDutyBps,
    pfThresholdBps: tariffRow.pfThresholdBps,
    pfPenaltyRatePaisa: tariffRow.pfPenaltyRatePaisa,
    gstRateBps: tariffRow.gstRateBps,
    version: tariffRow.version,
    ...(tariffRow.oaCssRatePaisa != null && {
      openAccess: {
        cssRatePaisa: tariffRow.oaCssRatePaisa,
        additionalSurchargePaisa: tariffRow.oaAdditionalSurchargePaisa ?? 0,
        transmissionLossBps: tariffRow.oaTransmissionLossBps ?? 0,
      },
    }),
  };

  // 2. Fetch readings for the billing period
  const readingRows = await db
    .select()
    .from(powerReadings)
    .where(
      and(
        eq(powerReadings.meterId, params.meterId),
        gte(powerReadings.timestamp, params.periodStart),
        lte(powerReadings.timestamp, params.periodEnd),
      ),
    )
    .all();

  // 3. Classify readings by ToD; for OA tariffs, separate solar/captive from grid.
  // Solar/captive are billed at PPA rates via powerSources — exclude from slot path to avoid double-counting.
  const OA_SOURCES = new Set(['solar', 'captive']);
  const oaKWhBySrc: Map<string, { kWh: number; ratePaisa: number }> = new Map();

  const classifiedReadings: ClassifiedReading[] = [];
  for (const r of readingRows) {
    const kWh = (r.kWh ?? 0) / 1000; // Convert from paisa-equivalent back to kWh
    const src = r.source ?? 'grid';

    if (tariff.openAccess && OA_SOURCES.has(src)) {
      // Accumulate OA kWh + use reading's stored rate as PPA rate
      const prev = oaKWhBySrc.get(src) ?? { kWh: 0, ratePaisa: r.ratePaisa ?? 0 };
      oaKWhBySrc.set(src, { kWh: prev.kWh + kWh, ratePaisa: r.ratePaisa ?? prev.ratePaisa });
    } else {
      const classification = classifyReading(new Date(r.timestamp), tariff);
      classifiedReadings.push({
        timestamp: r.timestamp,
        kWh,
        slotName: classification.slotName,
        slotType: classification.slotType,
        ratePaisa: classification.ratePaisa,
      });
    }
  }

  // Build powerSources when OA tariff is present
  let powerSources: PowerSourceInput[] | undefined;
  if (tariff.openAccess) {
    powerSources = [];
    for (const [src, { kWh, ratePaisa }] of oaKWhBySrc) {
      powerSources.push({ source: src as 'solar' | 'captive', kWh, ppaRatePaisa: ratePaisa });
    }
    // Grid kWh — informational entry in sourceBreakdown
    const gridKWh = classifiedReadings.reduce((sum, r) => sum + r.kWh, 0);
    if (gridKWh > 0) {
      powerSources.push({ source: 'grid', kWh: gridKWh });
    }
  }

  // 4. Calculate bill
  const billResult = calculateBill({
    readings: classifiedReadings,
    tariff,
    contractedDemandKVA: params.contractedDemandKVA,
    recordedDemandKVA: params.recordedDemandKVA,
    powerFactor: params.powerFactor,
    dgKWh: params.dgKWh ?? 0,
    dgRatePaisa: params.dgRatePaisa ?? 0,
    powerSources,
  });

  // 5. Store bill in DB
  const billId = generateId();
  const now = new Date().toISOString();

  await db.insert(bills).values({
    id: billId,
    tenantId: params.tenantId,
    meterId: params.meterId,
    tariffId: tariff.id,
    billingPeriodStart: params.periodStart,
    billingPeriodEnd: params.periodEnd,
    peakKwh: billResult.peakKWh,
    normalKwh: billResult.normalKWh,
    offPeakKwh: billResult.offPeakKWh,
    totalKwh: billResult.totalKWh,
    billedKvah: billResult.billedKVAh,
    contractedDemandKva: params.contractedDemandKVA,
    recordedDemandKva: params.recordedDemandKVA,
    billedDemandKva: billResult.billedDemandKVA,
    powerFactor: Math.round(params.powerFactor * 10000), // to BPS
    peakChargesPaisa: billResult.peakChargesPaisa,
    normalChargesPaisa: billResult.normalChargesPaisa,
    offPeakChargesPaisa: billResult.offPeakChargesPaisa,
    totalEnergyChargesPaisa: billResult.totalEnergyChargesPaisa,
    wheelingChargesPaisa: billResult.wheelingChargesPaisa,
    demandChargesPaisa: billResult.demandChargesPaisa,
    fuelAdjustmentPaisa: billResult.fuelAdjustmentPaisa,
    electricityDutyPaisa: billResult.electricityDutyPaisa,
    pfPenaltyPaisa: billResult.pfPenaltyPaisa,
    dgChargesPaisa: billResult.dgChargesPaisa,
    ppaEnergyChargesPaisa: billResult.ppaEnergyChargesPaisa,
    crossSubsidySurchargePaisa: billResult.crossSubsidySurchargePaisa,
    additionalSurchargePaisa: billResult.additionalSurchargePaisa,
    transmissionLossChargesPaisa: billResult.transmissionLossChargesPaisa,
    subtotalPaisa: billResult.subtotalPaisa,
    gstPaisa: billResult.gstPaisa,
    totalBillPaisa: billResult.totalBillPaisa,
    effectiveRatePaisaPerKwh: billResult.effectiveRatePaisaPerKWh,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });

  return {
    bill: billResult,
    billId,
    tariffId: tariff.id,
    readingCount: readingRows.length,
  };
}
