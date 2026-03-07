import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { uploadAudit } from '../db/schema.js';
import { importCSV } from '../services/csv-import.js';
import { requireAdmin } from '../middleware/rbac.js';

const uploadsRouter = new Hono<AppEnv>();

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// POST /uploads/csv — CSV file upload + import (tenant from JWT, admin only)
uploadsRouter.post('/csv', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }

  // Check content length
  const contentLength = parseInt(c.req.header('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    return c.json(
      { error: { code: 'PAYLOAD_TOO_LARGE', message: 'CSV file exceeds maximum upload size of 100MB' } },
      413,
    );
  }

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing file upload. Send as multipart form with field "file".' } },
      400,
    );
  }

  const content = await file.text();
  const result = await importCSV(content, file.name, file.size, tenantId, null, db);

  return c.json(result, result.importedRows > 0 ? 201 : 400);
});

// GET /uploads — list upload history (scoped by tenant)
uploadsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);
  const rows = await db.select().from(uploadAudit).where(eq(uploadAudit.tenantId, tenantId)).all();
  return c.json(rows);
});

// GET /uploads/:id — specific upload audit (scoped by tenant)
uploadsRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const tenantId = c.get('tenantId');
  const conditions = [eq(uploadAudit.id, id)];
  if (tenantId) conditions.push(eq(uploadAudit.tenantId, tenantId));
  const rows = await db.select().from(uploadAudit).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Upload ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

export { uploadsRouter };
