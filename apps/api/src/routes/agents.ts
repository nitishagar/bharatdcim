import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { agentHeartbeats } from '../db/schema.js';

type Env = { Variables: { db: Database } };

const agentsRouter = new Hono<Env>();

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

  // Upsert: check if agent exists
  const existing = await db.select().from(agentHeartbeats).where(eq(agentHeartbeats.agentId, agentId)).all();

  if (existing.length > 0) {
    await db.update(agentHeartbeats)
      .set({
        agentVersion: body.agent_version || body.agentVersion || null,
        deviceCount: body.device_count ?? body.deviceCount ?? 0,
        unsyncedCount: body.unsynced_count ?? body.unsyncedCount ?? 0,
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
      status: 'online',
      lastHeartbeatAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({ status: 'ok', agentId, timestamp: now });
});

// GET /agents — list registered agents
agentsRouter.get('/', async (c) => {
  const db = c.get('db');
  const rows = await db.select().from(agentHeartbeats).all();
  return c.json(rows);
});

export { agentsRouter };
