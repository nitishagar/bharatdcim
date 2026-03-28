import type { Bindings } from '../types.js';
import type { Database } from '../db/client.js';
import { notificationConfigs } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const VALID_EVENTS = [
  'capacity_warning',
  'capacity_critical',
  'sla_warning',
  'sla_breach',
] as const;

export type AlertEvent = (typeof VALID_EVENTS)[number];

export interface NotificationPayload {
  event: AlertEvent;
  tenantId: string;
  meterId?: string | null;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  message: string;
  timestamp: string;
}

export async function sendEmailNotification(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'alerts@bharatdcim.com', to: [to], subject, html }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Resend error ${response.status}: ${JSON.stringify(err)}`);
  }
}

export async function sendWebhookNotification(
  url: string,
  payload: NotificationPayload,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, source: 'bharatdcim' }),
  });
  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }
}

export async function dispatchNotifications(
  db: Database,
  env: Pick<Bindings, 'RESEND_API_KEY'>,
  tenantId: string,
  payload: NotificationPayload,
): Promise<void> {
  const configs = await db
    .select()
    .from(notificationConfigs)
    .where(
      and(
        eq(notificationConfigs.tenantId, tenantId),
        eq(notificationConfigs.status, 'active'),
      ),
    );

  for (const config of configs) {
    const events: string[] = JSON.parse(config.eventsJson || '[]');
    if (!events.includes(payload.event)) continue;

    if (config.type === 'email') {
      const subject = `[BharatDCIM Alert] ${payload.event}: ${payload.metric}`;
      const html = buildEmailHtml(payload);
      await sendEmailNotification(env.RESEND_API_KEY, config.destination, subject, html);
    } else if (config.type === 'webhook') {
      await sendWebhookNotification(config.destination, payload);
    }
  }
}

function buildEmailHtml(payload: NotificationPayload): string {
  return `
    <h2>BharatDCIM Alert: ${payload.event}</h2>
    <p><strong>Metric:</strong> ${payload.metric}</p>
    <p><strong>Current Value:</strong> ${payload.currentValue}</p>
    <p><strong>Threshold:</strong> ${payload.thresholdValue}</p>
    <p><strong>Time:</strong> ${payload.timestamp}</p>
    <p>${payload.message}</p>
    <hr><p style="color:#888;font-size:12px">BharatDCIM — Data Center Intelligence Platform</p>
  `;
}
