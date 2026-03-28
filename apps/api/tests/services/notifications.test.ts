import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import {
  sendEmailNotification,
  sendWebhookNotification,
  dispatchNotifications,
  type NotificationPayload,
} from '../../src/services/notifications.js';
import { notificationConfigs, tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const MOCK_ENV = { RESEND_API_KEY: 'test-api-key' };

const PAYLOAD: NotificationPayload = {
  event: 'capacity_warning',
  tenantId: 'tenant-1',
  meterId: 'meter-1',
  metric: 'kwh_daily',
  currentValue: 850000,
  thresholdValue: 800000,
  message: 'Daily kWh usage approaching critical threshold',
  timestamp: '2026-03-28T10:00:00.000Z',
};

describe('sendEmailNotification', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('calls Resend API with correct URL and method', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    await sendEmailNotification('key-123', 'ops@acme.com', 'Test Subject', '<p>body</p>');
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.method).toBe('POST');
  });

  it('includes Authorization header with API key', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    await sendEmailNotification('my-api-key', 'to@example.com', 'Sub', '<p>hi</p>');
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer my-api-key');
  });

  it('includes correct body fields', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 }),
    );
    await sendEmailNotification('key', 'to@example.com', 'Sub', '<b>hi</b>');
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.to).toEqual(['to@example.com']);
    expect(body.subject).toBe('Sub');
    expect(body.html).toBe('<b>hi</b>');
    expect(body.from).toBe('alerts@bharatdcim.com');
  });

  it('throws with error message on non-2xx response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 403 }),
    );
    await expect(
      sendEmailNotification('bad-key', 'to@example.com', 'Sub', '<p>hi</p>'),
    ).rejects.toThrow('Resend error 403');
  });
});

describe('sendWebhookNotification', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('calls webhook URL with POST', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('OK', { status: 200 }),
    );
    await sendWebhookNotification('https://hooks.example.com/alert', PAYLOAD);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://hooks.example.com/alert');
    expect(opts.method).toBe('POST');
  });

  it('sends JSON body with payload fields + source field', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('OK', { status: 200 }),
    );
    await sendWebhookNotification('https://hooks.example.com/alert', PAYLOAD);
    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('capacity_warning');
    expect(body.metric).toBe('kwh_daily');
    expect(body.source).toBe('bharatdcim');
    expect(body.timestamp).toBe(PAYLOAD.timestamp);
  });

  it('throws on non-2xx response with status code', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('', { status: 500 }),
    );
    await expect(
      sendWebhookNotification('https://hooks.example.com/alert', PAYLOAD),
    ).rejects.toThrow('Webhook failed with status 500');
  });
});

describe('dispatchNotifications', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('sends email to active email configs with matching event', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-1', tenantId: 'tenant-1', name: 'Ops Email', type: 'email',
      destination: 'ops@acme.com',
      eventsJson: JSON.stringify(['capacity_warning', 'capacity_critical']),
      status: 'active', createdAt: now, updatedAt: now,
    });
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', PAYLOAD);
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
  });

  it('sends webhook to active webhook configs with matching event', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-2', tenantId: 'tenant-1', name: 'Ops Hook', type: 'webhook',
      destination: 'https://hooks.example.com/alert',
      eventsJson: JSON.stringify(['capacity_warning']),
      status: 'active', createdAt: now, updatedAt: now,
    });
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', PAYLOAD);
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://hooks.example.com/alert');
  });

  it('skips configs with status !== active', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-3', tenantId: 'tenant-1', name: 'Paused', type: 'email',
      destination: 'ops@acme.com',
      eventsJson: JSON.stringify(['capacity_warning']),
      status: 'paused', createdAt: now, updatedAt: now,
    });
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', PAYLOAD);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skips configs where event not in events_json', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-4', tenantId: 'tenant-1', name: 'SLA Only', type: 'email',
      destination: 'ops@acme.com',
      eventsJson: JSON.stringify(['sla_breach']),
      status: 'active', createdAt: now, updatedAt: now,
    });
    await dispatchNotifications(db, MOCK_ENV, 'tenant-1', PAYLOAD);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles empty notification_configs array without error', async () => {
    await expect(
      dispatchNotifications(db, MOCK_ENV, 'tenant-1', PAYLOAD),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
