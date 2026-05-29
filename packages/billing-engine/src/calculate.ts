import Decimal from 'decimal.js';
import type { BillCalculationInput, BillOutput } from './types.js';
import { calculateBilledDemand } from './demand.js';

/**
 * Calculate a complete electricity bill from classified readings.
 *
 * All monetary outputs are in INTEGER paisa. Uses Decimal.js for
 * intermediate arithmetic to avoid floating-point drift, with
 * Math.round() to convert back to integer paisa at each step.
 */
export function calculateBill(input: BillCalculationInput): BillOutput {
  const { readings, tariff, contractedDemandKVA, recordedDemandKVA, powerFactor, dgKWh, dgRatePaisa } = input;

  // Sum kWh by slot type
  let peakKWh = 0;
  let normalKWh = 0;
  let offPeakKWh = 0;

  for (const reading of readings) {
    switch (reading.slotType) {
      case 'peak':
        peakKWh += reading.kWh;
        break;
      case 'normal':
        normalKWh += reading.kWh;
        break;
      case 'off-peak':
        offPeakKWh += reading.kWh;
        break;
    }
  }

  const totalKWh = peakKWh + normalKWh + offPeakKWh;

  // For kVAh states: billedKVAh = totalKWh / powerFactor
  const billedKVAh = tariff.billingUnit === 'kVAh'
    ? new Decimal(totalKWh).div(powerFactor).toNumber()
    : null;

  // The billed consumption for wheeling, FAC, etc.
  const billedConsumption = billedKVAh ?? totalKWh;

  // Calculate energy charges per slot using Decimal.js
  // Sum each reading's kWh × ratePaisa
  let peakChargesDecimal = new Decimal(0);
  let normalChargesDecimal = new Decimal(0);
  let offPeakChargesDecimal = new Decimal(0);

  for (const reading of readings) {
    const charge = new Decimal(reading.kWh).mul(reading.ratePaisa);
    switch (reading.slotType) {
      case 'peak':
        peakChargesDecimal = peakChargesDecimal.add(charge);
        break;
      case 'normal':
        normalChargesDecimal = normalChargesDecimal.add(charge);
        break;
      case 'off-peak':
        offPeakChargesDecimal = offPeakChargesDecimal.add(charge);
        break;
    }
  }

  // For kVAh states, scale energy charges by 1/powerFactor
  if (tariff.billingUnit === 'kVAh') {
    const pfFactor = new Decimal(1).div(powerFactor);
    peakChargesDecimal = peakChargesDecimal.mul(pfFactor);
    normalChargesDecimal = normalChargesDecimal.mul(pfFactor);
    offPeakChargesDecimal = offPeakChargesDecimal.mul(pfFactor);
  }

  const peakChargesPaisa = Math.round(peakChargesDecimal.toNumber());
  const normalChargesPaisa = Math.round(normalChargesDecimal.toNumber());
  const offPeakChargesPaisa = Math.round(offPeakChargesDecimal.toNumber());
  const totalEnergyChargesPaisa = peakChargesPaisa + normalChargesPaisa + offPeakChargesPaisa;

  // Wheeling charges: billedConsumption × wheelingChargePaisa
  const wheelingChargesPaisa = Math.round(
    new Decimal(billedConsumption).mul(tariff.wheelingChargePaisa).toNumber(),
  );

  // Demand charges: billedDemandKVA × demandChargePerKVAPaisa
  const billedDemandKVA = calculateBilledDemand(
    contractedDemandKVA,
    recordedDemandKVA,
    tariff.demandRatchetPercent,
    tariff.minimumDemandKVA,
  );
  const demandChargesPaisa = Math.round(
    new Decimal(billedDemandKVA).mul(tariff.demandChargePerKVAPaisa).toNumber(),
  );

  // Fuel Adjustment Charge
  let fuelAdjustmentPaisa: number;
  if (tariff.fuelAdjustmentType === 'percentage') {
    // FPPCA as basis points of energy charges (e.g., TN: 158 bps = 1.58%)
    fuelAdjustmentPaisa = Math.round(
      new Decimal(totalEnergyChargesPaisa).mul(tariff.fuelAdjustmentPaisa).div(10000).toNumber(),
    );
  } else {
    // Absolute: billedConsumption × fuelAdjustmentPaisa
    fuelAdjustmentPaisa = Math.round(
      new Decimal(billedConsumption).mul(tariff.fuelAdjustmentPaisa).toNumber(),
    );
  }

  // Electricity duty: (energy + wheeling + demand) × dutyBps / 10000
  const electricityDutyPaisa = Math.round(
    new Decimal(totalEnergyChargesPaisa + wheelingChargesPaisa + demandChargesPaisa)
      .mul(tariff.electricityDutyBps)
      .div(10000)
      .toNumber(),
  );

  // Power Factor penalty
  let pfPenaltyPaisa = 0;
  const pfThreshold = tariff.pfThresholdBps / 10000;
  if (powerFactor < pfThreshold) {
    // Penalty: (threshold - actual) × 100 / 10 × consumption × penaltyRate
    // Same formula as marketing site: (threshold - PF) × 10 × kWh × rate
    const penaltyFactor = new Decimal(pfThreshold).sub(powerFactor).mul(100).div(10);
    pfPenaltyPaisa = Math.round(
      penaltyFactor.mul(totalKWh).mul(tariff.pfPenaltyRatePaisa).toNumber(),
    );
  }

  // DG charges: dgKWh × dgRatePaisa
  const dgChargesPaisa = Math.round(
    new Decimal(dgKWh).mul(dgRatePaisa).toNumber(),
  );

  // Open Access charges (zero when powerSources absent — backward-compat guaranteed)
  let ppaEnergyChargesPaisa = 0;
  let crossSubsidySurchargePaisa = 0;
  let additionalSurchargePaisa = 0;
  let transmissionLossChargesPaisa = 0;
  const sourceBreakdown: BillOutput['sourceBreakdown'] = [];

  if (input.powerSources?.length) {
    const oa = tariff.openAccess;
    let oaKWh = 0;

    for (const ps of input.powerSources) {
      if (ps.source === 'grid') {
        // Grid kWh handled by slot path above — informational only in breakdown
        sourceBreakdown.push({ source: 'grid', kWh: ps.kWh, energyChargesPaisa: 0 });
        continue;
      }
      const rate = ps.ppaRatePaisa ?? 0;
      const charge = Math.round(new Decimal(ps.kWh).mul(rate).toNumber());
      ppaEnergyChargesPaisa += charge;
      oaKWh += ps.kWh;
      sourceBreakdown.push({ source: ps.source, kWh: ps.kWh, energyChargesPaisa: charge });
    }

    if (oa && oaKWh > 0) {
      crossSubsidySurchargePaisa = Math.round(new Decimal(oaKWh).mul(oa.cssRatePaisa).toNumber());
      additionalSurchargePaisa = Math.round(new Decimal(oaKWh).mul(oa.additionalSurchargePaisa).toNumber());
      // Transmission loss modeled as % of OA energy charge (unit gross-up simplification)
      transmissionLossChargesPaisa = Math.round(
        new Decimal(ppaEnergyChargesPaisa).mul(oa.transmissionLossBps).div(10000).toNumber(),
      );
    }
  }

  // Subtotal: sum all components
  const subtotalPaisa =
    totalEnergyChargesPaisa +
    wheelingChargesPaisa +
    demandChargesPaisa +
    fuelAdjustmentPaisa +
    electricityDutyPaisa +
    pfPenaltyPaisa +
    dgChargesPaisa +
    ppaEnergyChargesPaisa +
    crossSubsidySurchargePaisa +
    additionalSurchargePaisa +
    transmissionLossChargesPaisa;

  // GST: gstRateBps of subtotal (basis points / 10000)
  const gstPaisa = Math.round(
    new Decimal(subtotalPaisa).mul(tariff.gstRateBps).div(10000).toNumber(),
  );

  // Total
  const totalBillPaisa = subtotalPaisa + gstPaisa;

  // Effective rate per kWh (total consumption including DG)
  const totalConsumption = totalKWh + dgKWh;
  const effectiveRatePaisaPerKWh = totalConsumption > 0
    ? Math.round(new Decimal(totalBillPaisa).div(totalConsumption).toNumber())
    : 0;

  return {
    peakKWh,
    normalKWh,
    offPeakKWh,
    totalKWh,
    billedKVAh,
    peakChargesPaisa,
    normalChargesPaisa,
    offPeakChargesPaisa,
    totalEnergyChargesPaisa,
    wheelingChargesPaisa,
    demandChargesPaisa,
    billedDemandKVA,
    fuelAdjustmentPaisa,
    electricityDutyPaisa,
    pfPenaltyPaisa,
    dgChargesPaisa,
    ppaEnergyChargesPaisa,
    crossSubsidySurchargePaisa,
    additionalSurchargePaisa,
    transmissionLossChargesPaisa,
    sourceBreakdown,
    subtotalPaisa,
    gstPaisa,
    totalBillPaisa,
    effectiveRatePaisaPerKWh,
  };
}
