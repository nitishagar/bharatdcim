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
import { dispatchNotifications, sendInvoiceEmail } from '../services/notifications.js';
import { renderInvoicePdf } from '../services/invoice-pdf.js';
import { tenants } from '../db/schema.js';

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
    const result = await createInvoice(body.billId, body.supplierGSTIN, body.recipientGSTIN, db, tenantId, c.env, c.get('irpCtx'), body.recipientEmail);
    c.get('irpCtx').waitUntil(
      dispatchNotifications(db, c.env, tenantId, {
        event: 'invoice_generated',
        tenantId,
        message: `Invoice ${result.invoiceNumber} generated`,
        timestamp: result.invoice.createdAt,
        invoiceNumber: result.invoiceNumber,
        totalAmountPaisa: result.invoice.totalAmountPaisa,
      }).catch((err) => console.error('[NOTIFY] invoice_generated failed:', err)),
    );
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
    const result = await cancelInvoice(id, body.reason, db, tenantId, c.env);
    c.get('irpCtx').waitUntil(
      dispatchNotifications(db, c.env, tenantId, {
        event: 'invoice_cancelled',
        tenantId,
        message: `Invoice ${result.invoiceNumber} cancelled`,
        timestamp: result.updatedAt,
        invoiceNumber: result.invoiceNumber,
        totalAmountPaisa: result.totalAmountPaisa,
      }).catch((err) => console.error('[NOTIFY] invoice_cancelled failed:', err)),
    );
    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found') || message.includes('already cancelled')) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message } }, 400);
    }
    throw err;
  }
});

// POST /invoices/:id/send — manually send invoice PDF to recipient (admin only)
invoicesRouter.post('/:id/send', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({})) as { to?: string };

  const conditions = [eq(invoices.id, id), eq(invoices.tenantId, tenantId)];
  const invRows = await db.select().from(invoices).where(and(...conditions)).all();
  if (invRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Invoice ${id} not found` } }, 404);
  }
  const invoice = invRows[0];

  const tenantRows = await db.select().from(tenants).where(eq(tenants.id, tenantId)).all();
  const tenant = tenantRows[0];

  const to = body.to ?? invoice.recipientEmail ?? tenant?.billingEmail;
  if (!to) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'No recipient email — provide to in body or set recipient/billing email' } }, 400);
  }

  const apiKey = c.env?.RESEND_API_KEY;
  if (!apiKey) {
    return c.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Email service not configured' } }, 503);
  }

  try {
    const pdf = await renderInvoicePdf(invoice, tenant, c.env);
    await sendInvoiceEmail(apiKey, to, invoice.invoiceNumber, pdf);
    return c.json({ sent: true, to });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    return c.json({ error: { code: 'EMAIL_SEND_FAILED', message } }, 502);
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
    const result = await createCreditNote(body.invoiceId, body.amountPaisa, body.reason, db, tenantId, c.env, c.get('irpCtx'));
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
