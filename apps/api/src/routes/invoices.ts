import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { invoices } from '../db/schema.js';
import { createInvoice, cancelInvoice, createCreditNote } from '../services/invoicing.js';
import { requireAdmin } from '../middleware/rbac.js';

const invoicesRouter = new Hono<AppEnv>();

// GET /invoices — list invoices (scoped by tenant)
invoicesRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);
  const rows = await db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).all();
  return c.json(rows);
});

// POST /invoices — create invoice from bill (admin only)
invoicesRouter.post('/', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const body = await c.req.json();

  if (!body.billId || !body.supplierGSTIN || !body.recipientGSTIN) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: billId, supplierGSTIN, recipientGSTIN' } },
      400,
    );
  }

  try {
    const result = await createInvoice(body.billId, body.supplierGSTIN, body.recipientGSTIN, db);
    return c.json(result.invoice, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found') || message.includes('already invoiced')) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
    }
    throw err;
  }
});

// GET /invoices/:id — get invoice (verify tenant ownership)
invoicesRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(invoices.id, id)];
  if (tenantId) conditions.push(eq(invoices.tenantId, tenantId));
  const rows = await db.select().from(invoices).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Invoice ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

// POST /invoices/:id/cancel — cancel invoice (admin only)
invoicesRouter.post('/:id/cancel', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.reason) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required field: reason' } },
      400,
    );
  }

  try {
    const result = await cancelInvoice(id, body.reason, db);
    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found') || message.includes('already cancelled')) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
    }
    throw err;
  }
});

// POST /credit-notes — create credit note (admin only)
invoicesRouter.post('/credit-notes', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const body = await c.req.json();

  if (!body.invoiceId || !body.amountPaisa || !body.reason) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: invoiceId, amountPaisa, reason' } },
      400,
    );
  }

  try {
    const result = await createCreditNote(body.invoiceId, body.amountPaisa, body.reason, db);
    return c.json(result, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
  }
});

export { invoicesRouter };
