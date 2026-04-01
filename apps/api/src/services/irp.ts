import type { IRPPayload } from '@bharatdcim/billing-engine';
import type { Bindings } from '../types.js';

export interface GspConfig {
  apiKey: string;
  baseUrl: string;
}

export interface IrnResult {
  irn: string;
  ackNo: string;
  ackDt: string;
  signedQrCode: string;
}

export function buildGspConfig(env: Bindings): GspConfig {
  return {
    apiKey: env.GSP_API_KEY ?? '',
    baseUrl: env.GSP_BASE_URL ?? '',
  };
}

export function buildPlatformSeller(env: Bindings): { lglNm: string; addr1: string; loc: string; pin: number } {
  return {
    lglNm: env.PLATFORM_LEGAL_NAME ?? '',
    addr1: env.PLATFORM_ADDRESS1 ?? '',
    loc: env.PLATFORM_CITY ?? '',
    pin: parseInt(env.PLATFORM_PINCODE ?? '0', 10),
  };
}

/**
 * Generate an IRN by calling the GSP API.
 * On ErrorCode 2150 (duplicate IRN), treats as success (idempotent).
 */
export async function generateIrn(payload: IRPPayload, config: GspConfig): Promise<IrnResult> {
  const response = await fetch(`${config.baseUrl}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as Record<string, unknown>;

  // ErrorCode 2150 = duplicate IRN — treat as success
  if (!response.ok) {
    const errorCode = data.ErrorCode ?? data.errorCode;
    if (errorCode === 2150 || errorCode === '2150') {
      // Return the IRN data from the error response
      return {
        irn: (data.Irn ?? data.irn ?? '') as string,
        ackNo: String(data.AckNo ?? data.ackNo ?? ''),
        ackDt: (data.AckDt ?? data.ackDt ?? '') as string,
        signedQrCode: (data.SignedQRCode ?? data.signedQrCode ?? '') as string,
      };
    }
    const errMsg = (data.Message ?? data.message ?? `GSP error ${response.status}`) as string;
    throw new Error(errMsg);
  }

  return {
    irn: (data.Irn ?? data.irn ?? '') as string,
    ackNo: String(data.AckNo ?? data.ackNo ?? ''),
    ackDt: (data.AckDt ?? data.ackDt ?? '') as string,
    signedQrCode: (data.SignedQRCode ?? data.signedQrCode ?? '') as string,
  };
}

/**
 * Cancel an IRN via the GSP API.
 */
export async function cancelIrn(irn: string, reason: '1' | '2' | '3' | '4', config: GspConfig): Promise<void> {
  const response = await fetch(`${config.baseUrl}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({ Irn: irn, CnlRsn: reason }),
  });

  if (!response.ok) {
    const data = await response.json() as Record<string, unknown>;
    const errMsg = (data.Message ?? data.message ?? `GSP cancel error ${response.status}`) as string;
    throw new Error(errMsg);
  }
}

/**
 * Map a human-readable reason string to IRP cancellation reason code.
 * Codes: 1=Duplicate, 2=Data Entry Mistake, 3=Order Cancelled, 4=Other
 */
export function mapReasonToCode(reason: string): '1' | '2' | '3' | '4' {
  const lower = reason.toLowerCase();
  if (lower.includes('duplicate')) return '1';
  if (lower.includes('data entry') || lower.includes('data-entry')) return '2';
  if (lower.includes('order')) return '3';
  return '4';
}
