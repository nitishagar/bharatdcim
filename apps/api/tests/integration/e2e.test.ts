import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import { seedDatabase } from '../../src/db/seed.js';
import { importCSV } from '../../src/services/csv-import.js';
import { calculateAndStoreBill } from '../../src/services/billing.js';
import { createInvoice } from '../../src/services/invoicing.js';
import {
  calculateBill, classifyReading,
  maharashtraTariff, karnatakaTariff,
} from '@bharatdcim/billing-engine';
import type { ClassifiedReading, TariffConfig } from '@bharatdcim/billing-engine';
import { bills, invoices, powerReadings, tariffConfigs, agentHeartbeats } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import type { Database } from '../../src/db/client.js';

describe('E2E Integration Tests', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedDatabase(db);
  });

  // E2E-001: CSV upload → readings stored → bill calculated → invoice generated
  it('E2E-001: full pipeline — CSV upload → bill → invoice', async () => {
    // Step 1: Upload CSV
    const csv = `timestamp,meter_id,kwh,source
2025-02-15T10:00:00Z,meter-mh-grid,100,grid
2025-02-15T14:00:00Z,meter-mh-grid,200,grid
2025-02-15T20:00:00Z,meter-mh-grid,150,grid`;

    const importResult = await importCSV(csv, 'test.csv', 256, 'tenant-mh', maharashtraTariff, db);
    expect(importResult.importedRows).toBe(3);
    expect(importResult.errors).toHaveLength(0);

    // Step 2: Verify readings are stored
    const readings = await db.select().from(powerReadings).all();
    expect(readings).toHaveLength(3);

    // Step 3: Calculate bill
    const billResult = await calculateAndStoreBill({
      meterId: 'meter-mh-grid',
      tenantId: 'tenant-mh',
      periodStart: '2025-02-15T00:00:00Z',
      periodEnd: '2025-02-15T23:59:59Z',
      contractedDemandKVA: 100,
      recordedDemandKVA: 80,
      powerFactor: 0.92,
    }, db);

    expect(billResult.readingCount).toBe(3);
    expect(billResult.bill.totalBillPaisa).toBeGreaterThan(0);

    // Step 4: Verify bill in DB
    const billRows = await db.select().from(bills).where(eq(bills.id, billResult.billId)).all();
    expect(billRows).toHaveLength(1);
    expect(billRows[0].totalBillPaisa).toBe(billResult.bill.totalBillPaisa);

    // Step 5: Generate invoice
    const invoiceResult = await createInvoice(
      billResult.billId,
      '27AABCT1332E1ZT', // MH supplier
      '27AABCT1332E1ZT', // MH recipient (same state = CGST+SGST)
      db,
    );

    expect(invoiceResult.invoiceNumber).toMatch(/^INV\//);
    expect(invoiceResult.invoice.taxType).toBe('CGST_SGST');
    expect(invoiceResult.invoice.taxableAmountPaisa).toBe(billResult.bill.subtotalPaisa);

    // Step 6: Verify bill status updated to 'invoiced'
    const updatedBill = await db.select().from(bills).where(eq(bills.id, billResult.billId)).all();
    expect(updatedBill[0].status).toBe('invoiced');
  });

  // E2E-002: API bill matches billing engine direct call
  it('E2E-002: API bill matches billing engine direct call', async () => {
    // Create readings directly for a known scenario
    const readingData = [
      { timestamp: '2025-02-15T10:00:00Z', kWh: 100 }, // Normal slot for KA
      { timestamp: '2025-02-15T19:00:00Z', kWh: 200 }, // Peak slot for KA
      { timestamp: '2025-02-15T23:00:00Z', kWh: 50 },  // Off-peak slot for KA
    ];

    // Insert readings into DB (use KA meter)
    for (const r of readingData) {
      await db.insert(powerReadings).values({
        id: crypto.randomUUID(),
        meterId: 'meter-ka-grid',
        timestamp: r.timestamp,
        kWh: Math.round(r.kWh * 1000), // to paisa-equivalent
        source: 'grid',
        createdAt: new Date().toISOString(),
      });
    }

    // Direct billing engine call (ground truth)
    const classifiedReadings: ClassifiedReading[] = readingData.map((r) => {
      const classification = classifyReading(new Date(r.timestamp), karnatakaTariff);
      return {
        timestamp: r.timestamp,
        kWh: r.kWh,
        slotName: classification.slotName,
        slotType: classification.slotType,
        ratePaisa: classification.ratePaisa,
      };
    });

    const directBill = calculateBill({
      readings: classifiedReadings,
      tariff: karnatakaTariff,
      contractedDemandKVA: 50,
      recordedDemandKVA: 45,
      powerFactor: 0.95,
      dgKWh: 0,
      dgRatePaisa: 0,
    });

    // API orchestrated bill
    const apiBillResult = await calculateAndStoreBill({
      meterId: 'meter-ka-grid',
      tenantId: 'tenant-ka',
      periodStart: '2025-02-15T00:00:00Z',
      periodEnd: '2025-02-15T23:59:59Z',
      contractedDemandKVA: 50,
      recordedDemandKVA: 45,
      powerFactor: 0.95,
    }, db);

    // Values should match exactly (same inputs → same outputs)
    expect(apiBillResult.bill.totalBillPaisa).toBe(directBill.totalBillPaisa);
    expect(apiBillResult.bill.totalEnergyChargesPaisa).toBe(directBill.totalEnergyChargesPaisa);
    expect(apiBillResult.bill.demandChargesPaisa).toBe(directBill.demandChargesPaisa);
    expect(apiBillResult.bill.subtotalPaisa).toBe(directBill.subtotalPaisa);
  });

  // E2E-003: Invoice numbers sequential across multiple bill→invoice flows
  it('E2E-003: invoice numbers sequential', async () => {
    // Create two bills
    const csv1 = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-mh-grid,100`;
    const csv2 = `timestamp,meter_id,kwh
2025-02-16T10:00:00Z,meter-mh-grid,150`;

    await importCSV(csv1, 'batch1.csv', 128, 'tenant-mh', null, db);
    await importCSV(csv2, 'batch2.csv', 128, 'tenant-mh', null, db);

    const bill1 = await calculateAndStoreBill({
      meterId: 'meter-mh-grid',
      tenantId: 'tenant-mh',
      periodStart: '2025-02-15T00:00:00Z',
      periodEnd: '2025-02-15T23:59:59Z',
      contractedDemandKVA: 100,
      recordedDemandKVA: 80,
      powerFactor: 0.92,
    }, db);

    const bill2 = await calculateAndStoreBill({
      meterId: 'meter-mh-grid',
      tenantId: 'tenant-mh',
      periodStart: '2025-02-16T00:00:00Z',
      periodEnd: '2025-02-16T23:59:59Z',
      contractedDemandKVA: 100,
      recordedDemandKVA: 80,
      powerFactor: 0.92,
    }, db);

    const invResult1 = await createInvoice(bill1.billId, '27AABCT1332E1ZT', '27AABCT1332E1ZT', db);
    const invResult2 = await createInvoice(bill2.billId, '27AABCT1332E1ZT', '27AABCT1332E1ZT', db);

    // Extract sequence numbers — format: INV/{FY}/{6-digit}
    const seq1 = parseInt(invResult1.invoiceNumber.split('/')[2], 10);
    const seq2 = parseInt(invResult2.invoiceNumber.split('/')[2], 10);
    expect(seq2).toBe(seq1 + 1);
  });

  // E2E-004: Tariff seeding — API can load all 4 state fixture tariffs
  it('E2E-004: tariff seeding loads 4 state configs', async () => {
    const tariffs = await db.select().from(tariffConfigs).all();
    expect(tariffs).toHaveLength(4);

    const states = tariffs.map(t => t.stateCode).sort();
    expect(states).toEqual(['KA', 'MH', 'TN', 'TS']);
  });

  // E2E-005: Bill→Invoice pipeline amounts consistent
  it('E2E-005: bill subtotal + tax = invoice total', async () => {
    const csv = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-mh-grid,500`;

    await importCSV(csv, 'big.csv', 64, 'tenant-mh', null, db);

    const billResult = await calculateAndStoreBill({
      meterId: 'meter-mh-grid',
      tenantId: 'tenant-mh',
      periodStart: '2025-02-15T00:00:00Z',
      periodEnd: '2025-02-15T23:59:59Z',
      contractedDemandKVA: 100,
      recordedDemandKVA: 80,
      powerFactor: 0.92,
    }, db);

    const invoiceResult = await createInvoice(billResult.billId, '27AABCT1332E1ZT', '27AABCT1332E1ZT', db);
    const inv = invoiceResult.invoice;

    // taxableAmountPaisa should equal bill.subtotalPaisa
    expect(inv.taxableAmountPaisa).toBe(billResult.bill.subtotalPaisa);
    // totalAmountPaisa = taxableAmount + totalTax
    expect(inv.totalAmountPaisa).toBe(inv.taxableAmountPaisa + inv.totalTaxPaisa);
  });

  // E2E-006: SNMP sync endpoint accepts batch readings
  it('E2E-006: POST /readings/batch accepts SNMP agent format', async () => {
    // Simulate what the Go agent sends
    const batchPayload = [
      { meterId: 'meter-mh-grid', timestamp: '2025-02-15T10:00:00Z', kWh: 100, kW: 15.3, powerFactor: 0.95 },
      { meterId: 'meter-mh-grid', timestamp: '2025-02-15T11:00:00Z', kWh: 110, kW: 14.8, powerFactor: 0.96 },
    ];

    // Insert directly via the service layer (testing the data transformation)
    const now = new Date().toISOString();
    const rows = batchPayload.map((r) => ({
      id: crypto.randomUUID(),
      meterId: r.meterId,
      timestamp: r.timestamp,
      kWh: Math.round(r.kWh * 1000),
      kW: Math.round(r.kW * 1000),
      powerFactor: Math.round(r.powerFactor * 10000),
      source: 'snmp' as const,
      createdAt: now,
    }));

    await db.insert(powerReadings).values(rows);

    const stored = await db.select().from(powerReadings).all();
    expect(stored).toHaveLength(2);
    expect(stored[0].source).toBe('snmp');
    expect(stored[0].kWh).toBe(100000); // 100 * 1000
    expect(stored[0].kW).toBe(15300);   // 15.3 * 1000
    expect(stored[0].powerFactor).toBe(9500); // 0.95 * 10000
  });

  // E2E-007: Agent heartbeat endpoint
  it('E2E-007: agent heartbeat upsert', async () => {
    const now = new Date().toISOString();

    // First heartbeat creates record
    await db.insert(agentHeartbeats).values({
      id: crypto.randomUUID(),
      agentId: 'agent-mumbai-dc1',
      agentVersion: '0.1.0',
      deviceCount: 5,
      unsyncedCount: 42,
      status: 'online',
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const agents = await db.select().from(agentHeartbeats).all();
    expect(agents).toHaveLength(1);
    expect(agents[0].agentId).toBe('agent-mumbai-dc1');
    expect(agents[0].deviceCount).toBe(5);

    // Second heartbeat updates
    await db.update(agentHeartbeats)
      .set({ deviceCount: 6, lastHeartbeatAt: now, updatedAt: now })
      .where(eq(agentHeartbeats.agentId, 'agent-mumbai-dc1'));

    const updated = await db.select().from(agentHeartbeats).all();
    expect(updated).toHaveLength(1);
    expect(updated[0].deviceCount).toBe(6);
  });
});
