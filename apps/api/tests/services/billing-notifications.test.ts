import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import { dispatchNotifications } from '../../src/services/notifications.js';
import { notificationConfigs, tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Phase 3 — Billing lifecycle notifications', () => {
  let db: Database;
  const MOCK_ENV = { RESEND_API_KEY: 'test-key' } as any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  async function seedBillingEmailConfig() {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-billing', tenantId: 'tenant-1', name: 'Billing Email', type: 'email',
      destination: 'ops@example.com',
      eventsJson: JSON.stringify(['invoice_generated', 'irn_ready', 'invoice_cancelled', 'bill_created']),
      status: 'active', createdAt: now, updatedAt: now,
    });
  }

  it('dispatchNotifications routes bill_created to subscribed email config', async () => {
    await seedBillingEmailConfig();
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', {
      event: 'bill_created',
      tenantId: 'tenant-1',
      message: 'Bill bill-1 created (150000 paisa)',
      timestamp: '2026-06-18T00:00:00.000Z',
      totalAmountPaisa: 150000,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(body.subject).toContain('bill_created');
    // billing email should NOT contain "metric" block
    expect(body.html).not.toContain('Metric:');
  });

  it('dispatchNotifications routes invoice_generated to subscribed email config', async () => {
    await seedBillingEmailConfig();
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', {
      event: 'invoice_generated',
      tenantId: 'tenant-1',
      message: 'Invoice INV/2526/001 generated',
      timestamp: '2026-06-18T00:00:00.000Z',
      invoiceNumber: 'INV/2526/001',
      totalAmountPaisa: 200000,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(body.html).toContain('INV/2526/001');
  });

  it('billing events render billing HTML (not metric block)', async () => {
    await seedBillingEmailConfig();
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', {
      event: 'irn_ready',
      tenantId: 'tenant-1',
      message: 'IRN generated',
      timestamp: '2026-06-18T00:00:00.000Z',
      invoiceNumber: 'INV/2526/002',
      irn: 'abc123irn',
      totalAmountPaisa: 300000,
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(body.html).toContain('abc123irn');
    expect(body.html).toContain('BharatDCIM Billing:');
    expect(body.html).not.toContain('BharatDCIM Alert:');
  });

  it('config not subscribed to billing events → no dispatch', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-alert-only', tenantId: 'tenant-1', name: 'Alert Only', type: 'email',
      destination: 'ops@example.com',
      eventsJson: JSON.stringify(['capacity_warning']),
      status: 'active', createdAt: now, updatedAt: now,
    });
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', {
      event: 'bill_created',
      tenantId: 'tenant-1',
      message: 'Bill created',
      timestamp: '2026-06-18T00:00:00.000Z',
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('existing alert event tests still work (backward-compat)', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-alert', tenantId: 'tenant-1', name: 'Alert Email', type: 'email',
      destination: 'ops@example.com',
      eventsJson: JSON.stringify(['capacity_warning']),
      status: 'active', createdAt: now, updatedAt: now,
    });
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', {
      event: 'capacity_warning',
      tenantId: 'tenant-1',
      meterId: 'meter-1',
      metric: 'kwh_daily',
      currentValue: 850000,
      thresholdValue: 800000,
      message: 'Capacity warning',
      timestamp: '2026-06-18T00:00:00.000Z',
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(body.html).toContain('BharatDCIM Alert:');
    expect(body.html).toContain('kwh_daily');
  });
});
