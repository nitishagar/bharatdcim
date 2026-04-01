import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDb } from '../helpers.js';
import {
  tenants, tariffConfigs, meters, powerReadings, bills,
  invoices, invoiceSequences, creditNotes, invoiceAuditLog, uploadAudit,
  envReadings, alertRules, alertEvents,
  capacityThresholds, slaConfigs, alerts, slaViolations, notificationConfigs,
  irpRetryQueue,
} from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Drizzle Schema', () => {
  it('all tables can be created in-memory', async () => {
    const { client } = await createTestDb();
    // If createTestDb succeeds, all DDL statements executed correctly

    // Verify tables exist by querying sqlite_master
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = result.rows.map((r) => r.name as string);

    expect(tableNames).toContain('tenants');
    expect(tableNames).toContain('tariff_configs');
    expect(tableNames).toContain('meters');
    expect(tableNames).toContain('power_readings');
    expect(tableNames).toContain('bills');
    expect(tableNames).toContain('invoices');
    expect(tableNames).toContain('invoice_sequences');
    expect(tableNames).toContain('credit_notes');
    expect(tableNames).toContain('invoice_audit_log');
    expect(tableNames).toContain('upload_audit');
    // New tables from capacity planning + SLA management
    expect(tableNames).toContain('capacity_thresholds');
    expect(tableNames).toContain('sla_configs');
    expect(tableNames).toContain('alerts');
    expect(tableNames).toContain('sla_violations');
    expect(tableNames).toContain('notification_configs');
  });

  it('Drizzle table objects have correct column definitions', () => {
    // Verify key tables export the expected structure
    expect(tenants.id).toBeDefined();
    expect(tenants.name).toBeDefined();
    expect(tenants.gstin).toBeDefined();
    expect(tenants.stateCode).toBeDefined();

    expect(tariffConfigs.baseEnergyRatePaisa).toBeDefined();
    expect(tariffConfigs.timeSlotsJson).toBeDefined();
    expect(tariffConfigs.electricityDutyBps).toBeDefined();

    expect(bills.totalBillPaisa).toBeDefined();
    expect(bills.subtotalPaisa).toBeDefined();
    expect(bills.gstPaisa).toBeDefined();

    expect(invoices.invoiceNumber).toBeDefined();
    expect(invoices.taxType).toBeDefined();

    expect(uploadAudit.processingTimeMs).toBeDefined();
    expect(uploadAudit.errorsJson).toBeDefined();

    expect(capacityThresholds.metric).toBeDefined();
    expect(capacityThresholds.warningValue).toBeDefined();
    expect(capacityThresholds.criticalValue).toBeDefined();

    expect(slaConfigs.targetBps).toBeDefined();
    expect(slaConfigs.measurementWindow).toBeDefined();

    expect(alerts.type).toBeDefined();
    expect(alerts.severity).toBeDefined();
    expect(alerts.predictedBreachAt).toBeDefined();

    expect(slaViolations.actualBps).toBeDefined();
    expect(slaViolations.gapBps).toBeDefined();

    expect(notificationConfigs.eventsJson).toBeDefined();
    expect(notificationConfigs.destination).toBeDefined();
  });

  it('CRUD operations work on all major tables', async () => {
    const { db } = await createTestDb();
    const now = new Date().toISOString();

    // Insert tenant
    await db.insert(tenants).values({
      id: 't1', name: 'TestCo', stateCode: 'MH', createdAt: now, updatedAt: now,
    });

    // Insert tariff
    await db.insert(tariffConfigs).values({
      id: 'mh-2025', stateCode: 'MH', discom: 'MSEDCL', category: 'HT I(A)',
      effectiveFrom: '2025-01-01', billingUnit: 'kVAh',
      baseEnergyRatePaisa: 868, wheelingChargePaisa: 74,
      demandChargePerKvaPaisa: 60000, demandRatchetPercent: 75, minimumDemandKva: 50,
      timeSlotsJson: '[]', fuelAdjustmentPaisa: 72, fuelAdjustmentType: 'absolute',
      electricityDutyBps: 930, pfThresholdBps: 9000, pfPenaltyRatePaisa: 25,
      version: 1, createdAt: now, updatedAt: now,
    });

    // Insert meter
    await db.insert(meters).values({
      id: 'm1', tenantId: 't1', name: 'Grid A', stateCode: 'MH',
      tariffId: 'mh-2025', createdAt: now, updatedAt: now,
    });

    // Insert reading
    await db.insert(powerReadings).values({
      id: 'r1', meterId: 'm1', timestamp: now, createdAt: now,
    });

    // Verify reads
    const allTenants = await db.select().from(tenants).all();
    expect(allTenants).toHaveLength(1);
    expect(allTenants[0].name).toBe('TestCo');

    const allTariffs = await db.select().from(tariffConfigs).all();
    expect(allTariffs).toHaveLength(1);
    expect(allTariffs[0].baseEnergyRatePaisa).toBe(868);

    const allMeters = await db.select().from(meters).all();
    expect(allMeters).toHaveLength(1);

    const allReadings = await db.select().from(powerReadings).all();
    expect(allReadings).toHaveLength(1);
  });

  // ENV-DB-01: env_readings table exists after migration
  it('ENV-DB-01: env_readings table exists', async () => {
    const { client } = await createTestDb();
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = result.rows.map((r) => r.name as string);
    expect(tableNames).toContain('env_readings');
  });

  // ENV-DB-02: env_readings has expected columns
  it('ENV-DB-02: env_readings has correct columns', async () => {
    const { client } = await createTestDb();
    const result = await client.execute("PRAGMA table_info(env_readings)");
    const cols = result.rows.map((r) => r.name as string);
    expect(cols).toContain('id');
    expect(cols).toContain('meter_id');
    expect(cols).toContain('timestamp');
    expect(cols).toContain('temp_c_tenths');
    expect(cols).toContain('humidity_pct_tenths');
    expect(cols).toContain('source');
    expect(cols).toContain('created_at');
  });

  // ENV-DB-03: alert_rules table exists with required columns
  it('ENV-DB-03: alert_rules table exists with correct columns', async () => {
    const { client } = await createTestDb();
    const tableResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = tableResult.rows.map((r) => r.name as string);
    expect(tableNames).toContain('alert_rules');

    const colResult = await client.execute("PRAGMA table_info(alert_rules)");
    const cols = colResult.rows.map((r) => r.name as string);
    expect(cols).toContain('id');
    expect(cols).toContain('tenant_id');
    expect(cols).toContain('meter_id');
    expect(cols).toContain('metric');
    expect(cols).toContain('operator');
    expect(cols).toContain('threshold');
    expect(cols).toContain('severity');
    expect(cols).toContain('enabled');
  });

  // ENV-DB-04: alert_events table exists with required columns
  it('ENV-DB-04: alert_events table exists with correct columns', async () => {
    const { client } = await createTestDb();
    const tableResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = tableResult.rows.map((r) => r.name as string);
    expect(tableNames).toContain('alert_events');

    const colResult = await client.execute("PRAGMA table_info(alert_events)");
    const cols = colResult.rows.map((r) => r.name as string);
    expect(cols).toContain('id');
    expect(cols).toContain('tenant_id');
    expect(cols).toContain('rule_id');
    expect(cols).toContain('meter_id');
    expect(cols).toContain('value');
    expect(cols).toContain('threshold');
    expect(cols).toContain('severity');
    expect(cols).toContain('triggered_at');
    expect(cols).toContain('resolved_at');
  });

  // ENV-DB-05: env_readings.meter_id FK — bad meter_id throws
  it('ENV-DB-05: env_readings meter_id FK enforced', async () => {
    const { db } = await createTestDb();
    const now = new Date().toISOString();
    await expect(
      db.insert(envReadings).values({
        id: 'er1', meterId: 'nonexistent-meter', timestamp: now, createdAt: now,
      })
    ).rejects.toThrow();
  });

  // ENV-DB-06: alert_events.rule_id FK — bad rule_id throws
  it('ENV-DB-06: alert_events rule_id FK enforced', async () => {
    const { db } = await createTestDb();
    const now = new Date().toISOString();
    await expect(
      db.insert(alertEvents).values({
        id: 'ae1', tenantId: 'nonexistent-tenant', ruleId: 'nonexistent-rule',
        meterId: 'nonexistent-meter', value: 300, threshold: 280,
        severity: 'warning', triggeredAt: now, createdAt: now,
      })
    ).rejects.toThrow();
  });

  // Drizzle column definitions for new tables
  it('ENV-DB-07: Drizzle envReadings column definitions', () => {
    expect(envReadings.id).toBeDefined();
    expect(envReadings.meterId).toBeDefined();
    expect(envReadings.tempCTenths).toBeDefined();
    expect(envReadings.humidityPctTenths).toBeDefined();
  });

  it('ENV-DB-08: Drizzle alertRules column definitions', () => {
    expect(alertRules.id).toBeDefined();
    expect(alertRules.tenantId).toBeDefined();
    expect(alertRules.metric).toBeDefined();
    expect(alertRules.threshold).toBeDefined();
    expect(alertRules.enabled).toBeDefined();
  });
});

describe('IRP Schema tests', () => {
  let db: Database;

  const baseNow = '2026-04-01T00:00:00Z';

  async function seedBase(localDb: Database) {
    await (localDb as any).insert(tenants).values({
      id: 'tenant-001', name: 'Test DC', stateCode: 'MH', createdAt: baseNow, updatedAt: baseNow,
    });
    await (localDb as any).insert(tariffConfigs).values({
      id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2025-01-01',
      billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
      demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75, minimumDemandKva: 50,
      timeSlotsJson: '[]', fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
      electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20,
      version: 1, createdAt: baseNow, updatedAt: baseNow,
    });
    await (localDb as any).insert(meters).values({
      id: 'meter-001', tenantId: 'tenant-001', name: 'Main Meter', stateCode: 'MH',
      tariffId: 'tc1', createdAt: baseNow, updatedAt: baseNow,
    });
    await (localDb as any).insert(bills).values({
      id: 'bill-001', tenantId: 'tenant-001', meterId: 'meter-001', tariffId: 'tc1',
      billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
      peakKwh: 100, normalKwh: 500, offPeakKwh: 100, totalKwh: 700,
      contractedDemandKva: 100, recordedDemandKva: 90, billedDemandKva: 100,
      powerFactor: 9500, peakChargesPaisa: 80000, normalChargesPaisa: 350000,
      offPeakChargesPaisa: 70000, totalEnergyChargesPaisa: 500000,
      wheelingChargesPaisa: 35000, demandChargesPaisa: 500000,
      fuelAdjustmentPaisa: 35000, electricityDutyPaisa: 64200, pfPenaltyPaisa: 0,
      dgChargesPaisa: 0, subtotalPaisa: 1134200, gstPaisa: 204156, totalBillPaisa: 1338356,
      effectiveRatePaisaPerKwh: 1912, createdAt: baseNow, updatedAt: baseNow,
    });
  }

  async function seedInvoice(localDb: Database) {
    await (localDb as any).insert(invoices).values({
      id: 'invoice-001', billId: 'bill-001', tenantId: 'tenant-001',
      invoiceNumber: 'INV/2627/000001', financialYear: '2627',
      supplierGstin: '27AAPFU0939F1ZV', recipientGstin: '29ABCDE1234F1Z5',
      taxType: 'CGST_SGST', taxableAmountPaisa: 1134200,
      cgstPaisa: 102078, sgstPaisa: 102078, igstPaisa: null,
      totalTaxPaisa: 204156, totalAmountPaisa: 1338356,
      invoiceDate: baseNow, createdAt: baseNow, updatedAt: baseNow,
    });
  }

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  it('SCHEMA-01: invoices row inserted with no e_invoice_status gets default not_applicable', async () => {
    await seedInvoice(db);
    const rows = await (db as any).select().from(invoices).where(eq(invoices.id, 'invoice-001')).all();
    expect(rows[0].eInvoiceStatus).toBe('not_applicable');
  });

  it('SCHEMA-02: invoices row can be updated with IRN fields and irn_generated status', async () => {
    await seedInvoice(db);
    await (db as any).update(invoices).set({
      irn: 'a'.repeat(64),
      ackNo: '112010000011474',
      ackDt: '2026-04-01 14:30:00',
      signedQrCode: 'eyJhbGciOiJSUzI1NiJ9.mock.sig',
      eInvoiceStatus: 'irn_generated',
      irnGeneratedAt: baseNow,
      updatedAt: baseNow,
    }).where(eq(invoices.id, 'invoice-001'));

    const rows = await (db as any).select().from(invoices).where(eq(invoices.id, 'invoice-001')).all();
    expect(rows[0].eInvoiceStatus).toBe('irn_generated');
    expect(rows[0].irn).toBe('a'.repeat(64));
    expect(rows[0].ackNo).toBe('112010000011474');
    expect(rows[0].signedQrCode).toBe('eyJhbGciOiJSUzI1NiJ9.mock.sig');
  });

  it('SCHEMA-03: tenants rows have legalName, address1, city, pincode (nullable); existing rows unaffected', async () => {
    const rows = await (db as any).select().from(tenants).where(eq(tenants.id, 'tenant-001')).all();
    expect(rows[0].legalName).toBeNull();
    expect(rows[0].address1).toBeNull();
    expect(rows[0].city).toBeNull();
    expect(rows[0].pincode).toBeNull();
    expect(rows[0].name).toBe('Test DC');
    expect(rows[0].stateCode).toBe('MH');
  });

  it('SCHEMA-04: irp_retry_queue INSERT with required fields succeeds', async () => {
    await seedInvoice(db);
    await (db as any).insert(irpRetryQueue).values({
      id: 'retry-001',
      invoiceId: 'invoice-001',
      documentType: 'INV',
      attemptCount: 0,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      payloadJson: JSON.stringify({ version: '1.1' }),
      status: 'pending',
      createdAt: baseNow,
      updatedAt: baseNow,
    });

    const rows = await (db as any).select().from(irpRetryQueue).where(eq(irpRetryQueue.id, 'retry-001')).all();
    expect(rows[0].documentType).toBe('INV');
    expect(rows[0].status).toBe('pending');
    expect(rows[0].attemptCount).toBe(0);
  });

  it('SEQ-01: 10 concurrent nextSequence upserts for same FY produce 10 distinct values', async () => {
    const fy = '2627';
    const nowTs = new Date().toISOString();

    const results = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const res = await (db as any)
          .insert(invoiceSequences)
          .values({ id: `seq-${i}`, financialYear: fy, lastSequence: 1, updatedAt: nowTs })
          .onConflictDoUpdate({
            target: invoiceSequences.financialYear,
            set: {
              lastSequence: sql`${invoiceSequences.lastSequence} + 1`,
              updatedAt: nowTs,
            },
          })
          .returning({ lastSequence: invoiceSequences.lastSequence });
        return res[0].lastSequence;
      }),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(10);
  });
});
