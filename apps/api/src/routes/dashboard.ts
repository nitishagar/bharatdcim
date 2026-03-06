import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { meters, bills, invoices, agentHeartbeats } from '../db/schema.js';
import type { AppEnv } from '../types.js';

const dashboardRouter = new Hono<AppEnv>();

// GET /dashboard/summary — aggregated KPIs (scoped by tenant)
dashboardRouter.get('/summary', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const meterCondition = tenantId ? eq(meters.tenantId, tenantId) : undefined;
  const billCondition = tenantId ? eq(bills.tenantId, tenantId) : undefined;
  const invoiceCondition = tenantId ? eq(invoices.tenantId, tenantId) : undefined;

  const [meterStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(meters)
    .where(meterCondition)
    .all();

  const [billStats] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalPaisa: sql<number>`COALESCE(SUM(total_bill_paisa), 0)`,
      totalKwh: sql<number>`COALESCE(SUM(total_kwh), 0)`,
    })
    .from(bills)
    .where(billCondition)
    .all();

  const [invoiceStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoices)
    .where(invoiceCondition)
    .all();

  const [agentStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      online: sql<number>`SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END)`,
    })
    .from(agentHeartbeats)
    .all();

  return c.json({
    meters: { total: meterStats.count },
    bills: {
      total: billStats.count,
      totalAmountPaisa: billStats.totalPaisa,
      totalKwh: billStats.totalKwh,
    },
    invoices: { total: invoiceStats.count },
    agents: {
      total: agentStats.total,
      online: agentStats.online ?? 0,
    },
  });
});

export { dashboardRouter };
