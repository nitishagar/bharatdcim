import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, like, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { recCertificates, carbonEmissions } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';
import { CreateRecSchema, RetireRecSchema, ComputeEmissionsSchema } from '../schemas/sustainability.js';
import { validationHook } from '../utils/validationHook.js';
import { computeScope2, aggregateSourceKWh, activeRecOffsetKWh } from '../services/sustainability.js';

const sustainability = new Hono<AppEnv>();

// ─── REC Certificates ──────────────────────────────────────────

// GET /sustainability/recs — list with pagination/search
sustainability.get('/recs', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const { hasPagination, limit, offset, search } = parsePagination(c);

  const where = tenantId
    ? search
      ? and(eq(recCertificates.tenantId, tenantId), like(recCertificates.serialNumber, `%${search}%`))
      : eq(recCertificates.tenantId, tenantId)
    : search
      ? like(recCertificates.serialNumber, `%${search}%`)
      : undefined;

  if (!hasPagination) {
    const rows = where
      ? await db.select().from(recCertificates).where(where).all()
      : await db.select().from(recCertificates).all();
    return c.json(rows);
  }

  const [{ total }] = where
    ? await db.select({ total: sql<number>`COUNT(*)` }).from(recCertificates).where(where).all()
    : await db.select({ total: sql<number>`COUNT(*)` }).from(recCertificates).all();

  const data = where
    ? await db.select().from(recCertificates).where(where).limit(limit).offset(offset).all()
    : await db.select().from(recCertificates).limit(limit).offset(offset).all();

  return c.json({ data, total: Number(total), limit, offset });
});

// POST /sustainability/recs — create REC (admin only)
sustainability.post('/recs', zValidator('json', CreateRecSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const row = {
    id: body.id,
    tenantId: tenantId!,
    certificateType: body.certificateType,
    serialNumber: body.serialNumber,
    source: body.source,
    mwh: body.mwh,
    vintagePeriodStart: body.vintagePeriodStart,
    vintagePeriodEnd: body.vintagePeriodEnd,
    status: 'active' as const,
    retiredAt: null,
    retiredAgainstPeriod: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(recCertificates).values(row);
  return c.json(row, 201);
});

// PATCH /sustainability/recs/:id — update REC fields (admin only)
sustainability.patch('/recs/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(recCertificates.id, id)];
  if (tenantId) conditions.push(eq(recCertificates.tenantId, tenantId));

  const existing = await db.select({ id: recCertificates.id }).from(recCertificates).where(and(...conditions)).all();
  if (!existing.length) {
    return c.json({ error: { code: 'NOT_FOUND', message: `REC ${id} not found` } }, 404);
  }

  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.serialNumber !== undefined) updates.serialNumber = body.serialNumber;
  if (body.source !== undefined) updates.source = body.source;
  if (body.mwh !== undefined) updates.mwh = body.mwh;

  await db.update(recCertificates).set(updates).where(eq(recCertificates.id, id));
  const updated = await db.select().from(recCertificates).where(eq(recCertificates.id, id)).all();
  return c.json(updated[0]);
});

// POST /sustainability/recs/:id/retire — retire a REC (admin only)
sustainability.post('/recs/:id/retire', zValidator('json', RetireRecSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const conditions = [eq(recCertificates.id, id)];
  if (tenantId) conditions.push(eq(recCertificates.tenantId, tenantId));

  const rows = await db.select().from(recCertificates).where(and(...conditions)).all();
  if (!rows.length) {
    return c.json({ error: { code: 'NOT_FOUND', message: `REC ${id} not found` } }, 404);
  }
  if (rows[0].status === 'retired') {
    return c.json({ error: { code: 'CONFLICT', message: 'REC is already retired' } }, 409);
  }

  const now = new Date().toISOString();
  await db.update(recCertificates).set({
    status: 'retired',
    retiredAt: now,
    retiredAgainstPeriod: body.retiredAgainstPeriod ?? null,
    updatedAt: now,
  }).where(eq(recCertificates.id, id));

  const updated = await db.select().from(recCertificates).where(eq(recCertificates.id, id)).all();
  return c.json(updated[0]);
});

// ─── Emissions ─────────────────────────────────────────────────

// POST /sustainability/emissions/compute — compute & store Scope-2 record (admin only)
sustainability.post('/emissions/compute', zValidator('json', ComputeEmissionsSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const body = c.req.valid('json');

  const { periodStart, periodEnd, gridEmissionFactorGPerKwh } = body;

  const { renewableKWh, nonRenewableKWh, totalKWh } = await aggregateSourceKWh(db, tenantId, periodStart, periodEnd);
  const recOffsetKWhValue = await activeRecOffsetKWh(db, tenantId, periodStart, periodEnd);

  const { scope2GrossKg, scope2NetKg, recOffsetKWh: cappedOffset } = computeScope2({
    nonRenewableKWh,
    gridEmissionFactorGPerKwh,
    recOffsetKWh: recOffsetKWhValue,
  });

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    tenantId,
    periodStart,
    periodEnd,
    gridEmissionFactorGPerKwh,
    // store kWh ×1000 as milliunits
    totalKwh: Math.round(totalKWh * 1000),
    renewableKwh: Math.round(renewableKWh * 1000),
    recOffsetKwh: Math.round(cappedOffset * 1000),
    scope2GrossKg,
    scope2NetKg,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(carbonEmissions).values(row);
  return c.json(row, 201);
});

// GET /sustainability/emissions — list Scope-2 records
sustainability.get('/emissions', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const { hasPagination, limit, offset } = parsePagination(c);

  const where = tenantId ? eq(carbonEmissions.tenantId, tenantId) : undefined;

  if (!hasPagination) {
    const rows = where
      ? await db.select().from(carbonEmissions).where(where).all()
      : await db.select().from(carbonEmissions).all();
    return c.json(rows);
  }

  const [{ total }] = where
    ? await db.select({ total: sql<number>`COUNT(*)` }).from(carbonEmissions).where(where).all()
    : await db.select({ total: sql<number>`COUNT(*)` }).from(carbonEmissions).all();

  const data = where
    ? await db.select().from(carbonEmissions).where(where).limit(limit).offset(offset).all()
    : await db.select().from(carbonEmissions).limit(limit).offset(offset).all();

  return c.json({ data, total: Number(total), limit, offset });
});

export { sustainability };
