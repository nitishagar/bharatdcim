import { Hono } from 'hono';
import { eq, like, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { agentHeartbeats } from '../db/schema.js';
import { parsePagination } from '../utils/pagination.js';

const agentsRouter = new Hono<AppEnv>();

// POST /agents/heartbeat — record agent heartbeat
agentsRouter.post('/heartbeat', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const now = new Date().toISOString();

  const agentId = body.agent_id || body.agentId;
  if (!agentId) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'agent_id is required' } },
      400,
    );
  }

  const tenantId = body.tenant_id || body.tenantId || null;

  // Upsert: check if agent exists
  const existing = await db.select().from(agentHeartbeats).where(eq(agentHeartbeats.agentId, agentId)).all();

  if (existing.length > 0) {
    await db.update(agentHeartbeats)
      .set({
        agentVersion: body.agent_version || body.agentVersion || null,
        deviceCount: body.device_count ?? body.deviceCount ?? 0,
        unsyncedCount: body.unsynced_count ?? body.unsyncedCount ?? 0,
        tenantId,
        status: 'online',
        lastHeartbeatAt: now,
        updatedAt: now,
      })
      .where(eq(agentHeartbeats.agentId, agentId));
  } else {
    await db.insert(agentHeartbeats).values({
      id: crypto.randomUUID(),
      agentId,
      agentVersion: body.agent_version || body.agentVersion || null,
      deviceCount: body.device_count ?? body.deviceCount ?? 0,
      unsyncedCount: body.unsynced_count ?? body.unsyncedCount ?? 0,
      tenantId,
      status: 'online',
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({ status: 'ok', agentId, timestamp: now }, 201);
});

// GET /agents — list registered agents, scoped by tenant
agentsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const { hasPagination, limit, offset } = parsePagination(c);

  if (tenantId) {
    const scopeWhere = eq(agentHeartbeats.tenantId, tenantId);

    if (!hasPagination) {
      const rows = await db.select().from(agentHeartbeats).where(scopeWhere).all();
      return c.json(rows);
    }

    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(agentHeartbeats).where(scopeWhere).all();
    const data = await db.select().from(agentHeartbeats).where(scopeWhere).limit(limit).offset(offset).all();
    return c.json({ data, total: Number(total), limit, offset });
  }

  // API_TOKEN or platform admin — return all
  if (!hasPagination) {
    const rows = await db.select().from(agentHeartbeats).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(agentHeartbeats).all();
  const data = await db.select().from(agentHeartbeats).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

export { agentsRouter };
