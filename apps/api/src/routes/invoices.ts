import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, like, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { invoices, invoiceAuditLog } from '../db/schema.js';
import { createInvoice, cancelInvoice, createCreditNote } from '../services/invoicing.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';
import { CreateInvoiceSchema, CancelInvoiceSchema, CreateCreditNoteSchema } from '../schemas/invoices.js';
import { validationHook } from '../utils/validationHook.js';

const invoicesRouter = new Hono<AppEnv>();

// GET /invoices — list invoices (scoped by tenant)
invoicesRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const { hasPagination, limit, offset, search } = parsePagination(c);

  const conditions: ReturnType<typeof eq>[] = [eq(invoices.tenantId, tenantId)];
  if (search) conditions.push(like(invoices.invoiceNumber, `%${search}%`));
  const where = and(...conditions);

  if (!hasPagination) {
    const rows = await db.select().from(invoices).where(where).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(invoices).where(where).all();
  const data = await db.select().from(invoices).where(where).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

// POST /invoices — create invoice from bill (admin only)
invoicesRouter.post('/', zValidator('json', CreateInvoiceSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const body = c.req.valid('json');

  try {
    const result = await createInvoice(body.billId, body.supplierGSTIN, body.recipientGSTIN, db, tenantId);
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
invoicesRouter.post('/:id/cancel', zValidator('json', CancelInvoiceSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const id = c.req.param('id');
  const body = c.req.valid('json');

  try {
    const result = await cancelInvoice(id, body.reason, db, tenantId);
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
invoicesRouter.post('/credit-notes', zValidator('json', CreateCreditNoteSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const body = c.req.valid('json');

  try {
    const result = await createCreditNote(body.invoiceId, body.amountPaisa, body.reason, db, tenantId);
    return c.json(result, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
  }
});

// GET /invoices/:id/audit-log — get audit entries for invoice (tenant-scoped)
invoicesRouter.get('/:id/audit-log', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  // Verify invoice belongs to this tenant
  const conditions = [eq(invoices.id, id)];
  if (tenantId) conditions.push(eq(invoices.tenantId, tenantId));
  const inv = await db.select({ id: invoices.id }).from(invoices).where(and(...conditions)).all();
  if (inv.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Invoice ${id} not found` } }, 404);
  }

  const rows = await db.select().from(invoiceAuditLog)
    .where(eq(invoiceAuditLog.invoiceId, id))
    .all();
  return c.json(rows);
});

export { invoicesRouter };
