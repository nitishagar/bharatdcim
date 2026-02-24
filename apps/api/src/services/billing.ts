import {
  calculateBill,
  classifyReading,
} from '@bharatdcim/billing-engine';
import type { TariffConfig, ClassifiedReading, BillOutput } from '@bharatdcim/billing-engine';
import { eq, and, gte, lte } from 'drizzle-orm';
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

  const tariffRows = await db.select().from(tariffConfigs).where(eq(tariffConfigs.id, meter.tariffId)).all();
  if (tariffRows.length === 0) {
    throw new Error(`Tariff ${meter.tariffId} not found`);
  }
  const tariffRow = tariffRows[0];

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
    version: tariffRow.version,
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

  // 3. Classify each reading by ToD
  const classifiedReadings: ClassifiedReading[] = readingRows.map((r) => {
    const classification = classifyReading(new Date(r.timestamp), tariff);
    return {
      timestamp: r.timestamp,
      kWh: (r.kWh ?? 0) / 1000, // Convert from paisa-equivalent back to kWh
      slotName: classification.slotName,
      slotType: classification.slotType,
      ratePaisa: classification.ratePaisa,
    };
  });

  // 4. Calculate bill
  const billResult = calculateBill({
    readings: classifiedReadings,
    tariff,
    contractedDemandKVA: params.contractedDemandKVA,
    recordedDemandKVA: params.recordedDemandKVA,
    powerFactor: params.powerFactor,
    dgKWh: params.dgKWh ?? 0,
    dgRatePaisa: params.dgRatePaisa ?? 0,
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
