import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { tenants, meters, bills, invoices } from '../db/schema.js';

const platformRouter = new Hono<AppEnv>();

/** Guard: only platform admins can access /platform routes */
function requirePlatformAdmin(c: { get(key: 'platformAdmin'): boolean }) {
  if (!c.get('platformAdmin')) {
    throw new HTTPException(403, { message: 'Platform admin access required' });
  }
}

// GET /platform/tenants — list all tenants
platformRouter.get('/tenants', async (c) => {
  requirePlatformAdmin(c);
  const db = c.get('db');
  const rows = await db.select().from(tenants).all();
  return c.json(rows);
});

// POST /platform/tenants — create a new tenant (platform admin only)
platformRouter.post('/tenants', async (c) => {
  requirePlatformAdmin(c);
  const db = c.get('db');
  const body = await c.req.json();

  if (!body.name || !body.stateCode) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, stateCode' } },
      400,
    );
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    name: body.name as string,
    stateCode: body.stateCode as string,
    gstin: (body.gstin as string) ?? null,
    billingAddress: (body.billingAddress as string) ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tenants).values(row);
  return c.json(row, 201);
});

// PATCH /platform/tenants/:id — update tenant fields (platform admin only)
platformRouter.patch('/tenants/:id', async (c) => {
  requirePlatformAdmin(c);
  const db = c.get('db');
  const id = c.req.param('id');

  const existing = await db.select().from(tenants).where(eq(tenants.id, id)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Tenant ${id} not found` } }, 404);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();
  const updates: Partial<typeof tenants.$inferInsert> = { updatedAt: now };

  if (body.name !== undefined) updates.name = body.name as string;
  if (body.stateCode !== undefined) updates.stateCode = body.stateCode as string;
  if (body.gstin !== undefined) updates.gstin = body.gstin as string;
  if (body.billingAddress !== undefined) updates.billingAddress = body.billingAddress as string;

  await db.update(tenants).set(updates).where(eq(tenants.id, id));

  const [updated] = await db.select().from(tenants).where(eq(tenants.id, id)).all();
  return c.json(updated);
});

// GET /platform/overview — cross-tenant dashboard summary
platformRouter.get('/overview', async (c) => {
  requirePlatformAdmin(c);
  const db = c.get('db');

  const [meterStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(meters).all();

  const [billStats] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalPaisa: sql<number>`COALESCE(SUM(total_bill_paisa), 0)`,
    })
    .from(bills).all();

  const [invoiceStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoices).all();

  const [tenantStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenants).all();

  return c.json({
    tenants: { total: tenantStats.count },
    meters: { total: meterStats.count },
    bills: { total: billStats.count, totalAmountPaisa: billStats.totalPaisa },
    invoices: { total: invoiceStats.count },
  });
});

export { platformRouter };
