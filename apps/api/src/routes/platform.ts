import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sql } from 'drizzle-orm';
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
