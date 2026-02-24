import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers.js';
import { tariffs } from '../../src/routes/tariffs.js';
import { tariffConfigs } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

function createApp(db: Database) {
  const app = new Hono<{ Variables: { db: Database } }>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });
  app.route('/tariffs', tariffs);
  return app;
}

describe('Tariff Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createApp(db);
  });

  it('GET /tariffs — empty list', async () => {
    const res = await app.request('/tariffs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('POST /tariffs — create tariff config', async () => {
    const tariff = {
      id: 'mh-htia-2025',
      stateCode: 'MH',
      discom: 'MSEDCL / MERC',
      category: 'HT I(A)',
      effectiveFrom: '2025-01-01',
      billingUnit: 'kVAh',
      baseEnergyRatePaisa: 868,
      wheelingChargePaisa: 74,
      demandChargePerKvaPaisa: 60000,
      demandRatchetPercent: 75,
      minimumDemandKva: 50,
      timeSlots: [
        { name: 'Night Off-Peak', startHour: 22, startMinute: 0, endHour: 6, endMinute: 0, type: 'off-peak', multiplierBps: 10000, adderPaisa: -150 },
      ],
      fuelAdjustmentPaisa: 72,
      fuelAdjustmentType: 'absolute',
      electricityDutyBps: 930,
      pfThresholdBps: 9000,
      pfPenaltyRatePaisa: 25,
      version: 1,
    };

    const res = await app.request('/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tariff),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('mh-htia-2025');
    expect(body.stateCode).toBe('MH');
    expect(body.baseEnergyRatePaisa).toBe(868);
  });

  it('POST /tariffs — validation error on missing fields', async () => {
    const res = await app.request('/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discom: 'test' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /tariffs/:id — found', async () => {
    // Insert directly
    const now = new Date().toISOString();
    await (db as any).insert(tariffConfigs).values({
      id: 'ka-ht2a-2025',
      stateCode: 'KA',
      discom: 'BESCOM',
      category: 'HT-2(a)',
      effectiveFrom: '2025-01-01',
      billingUnit: 'kWh',
      baseEnergyRatePaisa: 660,
      wheelingChargePaisa: 0,
      demandChargePerKvaPaisa: 35000,
      demandRatchetPercent: 100,
      minimumDemandKva: 0,
      timeSlotsJson: '[]',
      fuelAdjustmentPaisa: 28,
      fuelAdjustmentType: 'absolute',
      electricityDutyBps: 600,
      pfThresholdBps: 9000,
      pfPenaltyRatePaisa: 15,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const res = await app.request('/tariffs/ka-ht2a-2025');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stateCode).toBe('KA');
    expect(body.baseEnergyRatePaisa).toBe(660);
  });

  it('GET /tariffs/:id — not found', async () => {
    const res = await app.request('/tariffs/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('GET /tariffs — lists created tariffs', async () => {
    // Create via API
    await app.request('/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'tn-hti-2025', stateCode: 'TN', discom: 'TANGEDCO', category: 'HT I',
        baseEnergyRatePaisa: 750, billingUnit: 'kWh', timeSlots: [],
      }),
    });
    await app.request('/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'ts-htia-2025', stateCode: 'TS', discom: 'TGSPDCL', category: 'HT-I(A)',
        baseEnergyRatePaisa: 765, billingUnit: 'kVAh', timeSlots: [],
      }),
    });

    const res = await app.request('/tariffs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});
