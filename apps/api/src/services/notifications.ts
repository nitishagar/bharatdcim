import type { Bindings } from '../types.js';
import type { Database } from '../db/client.js';
import { notificationConfigs } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const VALID_EVENTS = [
  'capacity_warning',
  'capacity_critical',
  'sla_warning',
  'sla_breach',
  'env_temperature_breach',
  'env_humidity_breach',
  'invoice_generated',
  'irn_ready',
  'invoice_cancelled',
  'bill_created',
] as const;

export type AlertEvent = (typeof VALID_EVENTS)[number];

export interface NotificationPayload {
  event: AlertEvent;
  tenantId: string;
  message: string;
  timestamp: string;
  meterId?: string | null;
  // alert-shaped (optional)
  metric?: string;
  currentValue?: number;
  thresholdValue?: number;
  // billing-shaped (optional)
  invoiceNumber?: string;
  irn?: string | null;
  totalAmountPaisa?: number;
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

export async function sendInvoiceEmail(
  apiKey: string,
  to: string,
  invoiceNumber: string,
  pdfBytes: Uint8Array,
): Promise<void> {
  // Use chunked btoa to avoid stack overflow on large PDFs (>~100KB spread arg limit)
  let base64 = '';
  const chunk = 8192;
  for (let i = 0; i < pdfBytes.length; i += chunk) {
    base64 += btoa(String.fromCharCode(...pdfBytes.subarray(i, i + chunk)));
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'billing@bharatdcim.com',
      to: [to],
      subject: `Invoice ${invoiceNumber} from BharatDCIM`,
      html: `<p>Please find attached invoice <strong>${invoiceNumber}</strong>.</p><hr><p style="color:#888;font-size:12px">BharatDCIM — Data Center Intelligence Platform</p>`,
      attachments: [{
        filename: `${invoiceNumber}.pdf`,
        content: base64,
        content_type: 'application/pdf',
      }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Resend attachment error ${response.status}: ${JSON.stringify(err)}`);
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
      const subjectSuffix = BILLING_EVENTS.has(payload.event)
        ? (payload.invoiceNumber ?? payload.event)
        : (payload.metric ?? payload.event);
      const subject = BILLING_EVENTS.has(payload.event)
        ? `[BharatDCIM Billing] ${payload.event}: ${subjectSuffix}`
        : `[BharatDCIM Alert] ${payload.event}: ${subjectSuffix}`;
      const html = buildEmailHtml(payload);
      await sendEmailNotification(env.RESEND_API_KEY, config.destination, subject, html);
    } else if (config.type === 'webhook') {
      await sendWebhookNotification(config.destination, payload);
    }
  }
}

const BILLING_EVENTS = new Set(['invoice_generated', 'irn_ready', 'invoice_cancelled', 'bill_created']);

function buildEmailHtml(payload: NotificationPayload): string {
  if (BILLING_EVENTS.has(payload.event)) {
    const amountStr = payload.totalAmountPaisa != null
      ? `INR ${(payload.totalAmountPaisa / 100).toLocaleString('en-IN')}`
      : '';
    const billingBlock = [
      payload.invoiceNumber ? `<p><strong>Invoice:</strong> ${payload.invoiceNumber}</p>` : '',
      amountStr ? `<p><strong>Amount:</strong> ${amountStr}</p>` : '',
      payload.irn ? `<p><strong>IRN:</strong> ${payload.irn}</p>` : '',
    ].join('');
    return `
      <h2>BharatDCIM Billing: ${payload.event}</h2>
      ${billingBlock}
      <p><strong>Time:</strong> ${payload.timestamp}</p>
      <p>${payload.message}</p>
      <hr><p style="color:#888;font-size:12px">BharatDCIM — Data Center Intelligence Platform</p>
    `;
  }
  const metricBlock = payload.metric != null
    ? `<p><strong>Metric:</strong> ${payload.metric}</p>
    <p><strong>Current Value:</strong> ${payload.currentValue}</p>
    <p><strong>Threshold:</strong> ${payload.thresholdValue}</p>`
    : '';
  return `
    <h2>BharatDCIM Alert: ${payload.event}</h2>
    ${metricBlock}
    <p><strong>Time:</strong> ${payload.timestamp}</p>
    <p>${payload.message}</p>
    <hr><p style="color:#888;font-size:12px">BharatDCIM — Data Center Intelligence Platform</p>
  `;
}
