import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { notificationConfigs } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { validationHook } from '../utils/validationHook.js';
import { CreateNotificationSchema, UpdateNotificationSchema } from '../schemas/notifications.js';
import { sendEmailNotification, sendWebhookNotification } from '../services/notifications.js';

const notificationsRouter = new Hono<AppEnv>();

// POST /notifications — create notification config (admin only)
notificationsRouter.post('/', zValidator('json', CreateNotificationSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    tenantId,
    name: body.name,
    type: body.type,
    destination: body.destination,
    eventsJson: JSON.stringify(body.events),
    status: body.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(notificationConfigs).values(row);
  return c.json({ ...row, events: body.events }, 201);
});

// GET /notifications — list for tenant
notificationsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const rows = await db
    .select()
    .from(notificationConfigs)
    .where(eq(notificationConfigs.tenantId, tenantId))
    .all();

  return c.json(rows);
});

// PATCH /notifications/:id — update (admin only)
notificationsRouter.patch('/:id', zValidator('json', UpdateNotificationSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(notificationConfigs.id, id)];
  if (tenantId) conditions.push(eq(notificationConfigs.tenantId, tenantId));

  const existing = await db.select({ id: notificationConfigs.id }).from(notificationConfigs).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Notification config not found or belongs to another tenant' } }, 403);
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.destination !== undefined) updates.destination = body.destination;
  if (body.events !== undefined) updates.eventsJson = JSON.stringify(body.events);
  if (body.status !== undefined) updates.status = body.status;

  await db.update(notificationConfigs).set(updates).where(eq(notificationConfigs.id, id));
  const updated = await db.select().from(notificationConfigs).where(eq(notificationConfigs.id, id)).all();
  return c.json(updated[0]);
});

// DELETE /notifications/:id — delete (admin only)
notificationsRouter.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(notificationConfigs.id, id)];
  if (tenantId) conditions.push(eq(notificationConfigs.tenantId, tenantId));

  const existing = await db.select({ id: notificationConfigs.id }).from(notificationConfigs).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Notification config not found or belongs to another tenant' } }, 403);
  }

  await db.delete(notificationConfigs).where(eq(notificationConfigs.id, id));
  return new Response(null, { status: 204 });
});

// POST /notifications/:id/test — send a test notification
notificationsRouter.post('/:id/test', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(notificationConfigs.id, id)];
  if (tenantId) conditions.push(eq(notificationConfigs.tenantId, tenantId));

  const rows = await db.select().from(notificationConfigs).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Notification config not found or belongs to another tenant' } }, 403);
  }

  const config = rows[0];
  const testPayload = {
    event: 'capacity_warning' as const,
    tenantId: config.tenantId,
    metric: 'kwh_daily',
    currentValue: 850000,
    thresholdValue: 1000000,
    message: 'Test notification from BharatDCIM',
    timestamp: new Date().toISOString(),
  };

  if (config.type === 'email') {
    const apiKey = c.env?.RESEND_API_KEY;
    if (!apiKey) {
      return c.json({ error: { code: 'CONFIGURATION_ERROR', message: 'RESEND_API_KEY not configured' } }, 500);
    }
    await sendEmailNotification(apiKey, config.destination, '[BharatDCIM Test] capacity_warning: kwh_daily', `<p>Test notification: ${JSON.stringify(testPayload)}</p>`);
  } else if (config.type === 'webhook') {
    await sendWebhookNotification(config.destination, testPayload);
  }

  return c.json({ sent: true, type: config.type, destination: config.destination });
});

export { notificationsRouter };
