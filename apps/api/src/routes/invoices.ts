import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { invoices } from '../db/schema.js';
import { createInvoice, cancelInvoice, createCreditNote } from '../services/invoicing.js';

type Env = { Variables: { db: Database } };

const invoicesRouter = new Hono<Env>();

// POST /invoices — create invoice from bill
invoicesRouter.post('/', async (c) => {
  const db = c.get('db');
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

// GET /invoices/:id — get invoice
invoicesRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db.select().from(invoices).where(eq(invoices.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Invoice ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

// POST /invoices/:id/cancel — cancel invoice
invoicesRouter.post('/:id/cancel', async (c) => {
  const db = c.get('db');
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

// POST /credit-notes — create credit note
invoicesRouter.post('/credit-notes', async (c) => {
  const db = c.get('db');
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
