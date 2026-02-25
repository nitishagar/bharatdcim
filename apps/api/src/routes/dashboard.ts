import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { meters, bills, invoices, agentHeartbeats } from '../db/schema.js';
import type { Database } from '../db/client.js';

type Env = { Variables: { db: Database } };

const dashboardRouter = new Hono<Env>();

// GET /dashboard/summary — aggregated KPIs
dashboardRouter.get('/summary', async (c) => {
  const db = c.get('db');

  const [meterStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(meters)
    .all();

  const [billStats] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalPaisa: sql<number>`COALESCE(SUM(total_bill_paisa), 0)`,
      totalKwh: sql<number>`COALESCE(SUM(total_kwh), 0)`,
    })
    .from(bills)
    .all();

  const [invoiceStats] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoices)
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
