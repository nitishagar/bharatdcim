import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { dashboardRouter } from '../../src/routes/dashboard.js';
import { tenants, meters, tariffConfigs, bills, invoices, agentHeartbeats } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-02-25T00:00:00Z';

describe('GET /dashboard/summary', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 't1');
    app.route('/dashboard', dashboardRouter);
  });

  it('returns zeroes on empty database', async () => {
    const res = await app.request('/dashboard/summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      meters: { total: 0 },
      bills: { total: 0, totalAmountPaisa: 0, totalKwh: 0 },
      invoices: { total: 0 },
      agents: { total: 0, online: 0 },
    });
  });

  it('returns correct aggregates with data', async () => {
    // Seed prerequisite data
    await (db as any).insert(tenants).values({
      id: 't1', name: 'Tenant A', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(tariffConfigs).values({
      id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2025-01-01',
      billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
      demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75, minimumDemandKva: 50,
      timeSlotsJson: '[]', fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
      electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20,
      version: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values([
      { id: 'm1', tenantId: 't1', name: 'Meter 1', stateCode: 'MH', tariffId: 'tc1', createdAt: now, updatedAt: now },
      { id: 'm2', tenantId: 't1', name: 'Meter 2', stateCode: 'MH', tariffId: 'tc1', createdAt: now, updatedAt: now },
    ]);
    await (db as any).insert(bills).values({
      id: 'b1', tenantId: 't1', meterId: 'm1', tariffId: 'tc1',
      billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
      peakKwh: 100, normalKwh: 200, offPeakKwh: 50, totalKwh: 350,
      contractedDemandKva: 100, recordedDemandKva: 80, billedDemandKva: 80,
      powerFactor: 9500, peakChargesPaisa: 10000, normalChargesPaisa: 16000,
      offPeakChargesPaisa: 3000, totalEnergyChargesPaisa: 29000,
      wheelingChargesPaisa: 5000, demandChargesPaisa: 40000,
      fuelAdjustmentPaisa: 2000, electricityDutyPaisa: 1500, pfPenaltyPaisa: 0,
      dgChargesPaisa: 0, subtotalPaisa: 77500, gstPaisa: 13950,
      totalBillPaisa: 91450, effectiveRatePaisaPerKwh: 261, status: 'finalized',
      createdAt: now, updatedAt: now,
    });
    await (db as any).insert(invoices).values({
      id: 'inv1', billId: 'b1', tenantId: 't1', invoiceNumber: 'INV-2526-0001',
      financialYear: '2526', supplierGstin: '27AABCT1234F1ZH',
      recipientGstin: '27AABCT5678G1ZK', taxType: 'CGST_SGST',
      taxableAmountPaisa: 77500, cgstPaisa: 6975, sgstPaisa: 6975,
      totalTaxPaisa: 13950, totalAmountPaisa: 91450, status: 'finalized',
      invoiceDate: '2026-02-01', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(agentHeartbeats).values([
      { id: 'ah1', agentId: 'agent-1', deviceCount: 5, status: 'online', lastHeartbeatAt: now, createdAt: now, updatedAt: now },
      { id: 'ah2', agentId: 'agent-2', deviceCount: 3, status: 'offline', lastHeartbeatAt: now, createdAt: now, updatedAt: now },
    ]);

    const res = await app.request('/dashboard/summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meters.total).toBe(2);
    expect(body.bills.total).toBe(1);
    expect(body.bills.totalAmountPaisa).toBe(91450);
    expect(body.bills.totalKwh).toBe(350);
    expect(body.invoices.total).toBe(1);
    expect(body.agents.total).toBe(2);
    expect(body.agents.online).toBe(1);
  });
});
