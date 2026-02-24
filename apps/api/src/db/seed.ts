import {
  maharashtraTariff, tamilNaduTariff, karnatakaTariff, telanganaTariff,
} from '@bharatdcim/billing-engine';
import type { TariffConfig } from '@bharatdcim/billing-engine';
import { tenants, tariffConfigs, meters } from './schema.js';
import type { Database } from './client.js';

function tariffToRow(tariff: TariffConfig) {
  const now = new Date().toISOString();
  return {
    id: tariff.id,
    stateCode: tariff.stateCode,
    discom: tariff.discom,
    category: tariff.category,
    effectiveFrom: tariff.effectiveFrom,
    effectiveTo: tariff.effectiveTo,
    billingUnit: tariff.billingUnit,
    baseEnergyRatePaisa: tariff.baseEnergyRatePaisa,
    wheelingChargePaisa: tariff.wheelingChargePaisa,
    demandChargePerKvaPaisa: tariff.demandChargePerKVAPaisa,
    demandRatchetPercent: tariff.demandRatchetPercent,
    minimumDemandKva: tariff.minimumDemandKVA,
    timeSlotsJson: JSON.stringify(tariff.timeSlots),
    fuelAdjustmentPaisa: tariff.fuelAdjustmentPaisa,
    fuelAdjustmentType: tariff.fuelAdjustmentType,
    electricityDutyBps: tariff.electricityDutyBps,
    pfThresholdBps: tariff.pfThresholdBps,
    pfPenaltyRatePaisa: tariff.pfPenaltyRatePaisa,
    version: tariff.version,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Seeds the database with 4 state tariffs and test entities.
 */
export async function seedDatabase(db: Database): Promise<void> {
  const now = new Date().toISOString();

  // Seed tenants
  await db.insert(tenants).values([
    {
      id: 'tenant-mh',
      name: 'Mumbai DataCenter Pvt Ltd',
      gstin: '27AABCT1332E1ZT',
      stateCode: 'MH',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tenant-ka',
      name: 'Bangalore DC Services',
      gstin: '29AABCT1332E1ZP',
      stateCode: 'KA',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Seed all 4 state tariffs
  await db.insert(tariffConfigs).values([
    tariffToRow(maharashtraTariff),
    tariffToRow(tamilNaduTariff),
    tariffToRow(karnatakaTariff),
    tariffToRow(telanganaTariff),
  ]);

  // Seed meters
  await db.insert(meters).values([
    {
      id: 'meter-mh-grid',
      tenantId: 'tenant-mh',
      name: 'Grid Main MH',
      stateCode: 'MH',
      tariffId: maharashtraTariff.id,
      meterType: 'grid',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'meter-ka-grid',
      tenantId: 'tenant-ka',
      name: 'Grid Main KA',
      stateCode: 'KA',
      tariffId: karnatakaTariff.id,
      meterType: 'grid',
      createdAt: now,
      updatedAt: now,
    },
  ]);
}
