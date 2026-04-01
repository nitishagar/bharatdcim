import { eq, and, lte, sql } from 'drizzle-orm';
import { irpRetryQueue, invoices } from '../db/schema.js';
import type { Database } from '../db/client.js';
import type { Bindings } from '../types.js';
import { generateIrn, buildGspConfig } from './irp.js';
import type { IRPPayload } from '@bharatdcim/billing-engine';

const BACKOFF_MINUTES = [5, 15, 60, 360, 1440] as const;
const ABANDON_AFTER_MS = 72 * 60 * 60 * 1000;
const MAX_BATCH = 50;

function nextRetryDelay(attemptCount: number): number {
  const idx = Math.min(attemptCount, BACKOFF_MINUTES.length - 1);
  return BACKOFF_MINUTES[idx] * 60 * 1000;
}

export async function processIrpRetryQueue(db: Database, env: Bindings): Promise<void> {
  const now = new Date();
  const nowStr = now.toISOString();

  const rows = await (db as any)
    .select()
    .from(irpRetryQueue)
    .where(
      and(
        eq(irpRetryQueue.status, 'pending'),
        lte(irpRetryQueue.nextRetryAt, nowStr),
      ),
    )
    .orderBy(irpRetryQueue.nextRetryAt)
    .limit(MAX_BATCH)
    .all();

  for (const row of rows) {
    // Mark as processing
    await db.update(irpRetryQueue)
      .set({ status: 'processing', lastAttemptedAt: nowStr, updatedAt: nowStr })
      .where(eq(irpRetryQueue.id, row.id));

    try {
      const payload = JSON.parse(row.payloadJson) as IRPPayload;
      const irnResult = await generateIrn(payload, buildGspConfig(env));

      // Update invoice
      await db.update(invoices).set({
        irn: irnResult.irn,
        ackNo: irnResult.ackNo,
        ackDt: irnResult.ackDt,
        signedQrCode: irnResult.signedQrCode,
        eInvoiceStatus: 'irn_generated',
        irnGeneratedAt: nowStr,
        updatedAt: nowStr,
      }).where(eq(invoices.id, row.invoiceId));

      // Mark queue row succeeded
      await db.update(irpRetryQueue)
        .set({ status: 'succeeded', updatedAt: nowStr })
        .where(eq(irpRetryQueue.id, row.id));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newAttemptCount = row.attemptCount + 1;
      const createdAt = new Date(row.createdAt);
      const isExpired = newAttemptCount >= 5 && (now.getTime() - createdAt.getTime()) > ABANDON_AFTER_MS;

      if (isExpired) {
        await db.update(irpRetryQueue)
          .set({ status: 'abandoned', attemptCount: newAttemptCount, errorMessage, updatedAt: nowStr })
          .where(eq(irpRetryQueue.id, row.id));
        console.error('[IRP-RETRY] abandoned', JSON.stringify({
          invoiceId: row.invoiceId,
          attemptCount: newAttemptCount,
          errorMessage,
          createdAt: row.createdAt,
        }));
      } else {
        const nextRetryAt = new Date(now.getTime() + nextRetryDelay(row.attemptCount)).toISOString();
        await db.update(irpRetryQueue)
          .set({
            status: 'pending',
            attemptCount: newAttemptCount,
            nextRetryAt,
            errorMessage,
            updatedAt: nowStr,
          })
          .where(eq(irpRetryQueue.id, row.id));
      }
    }
  }
}
