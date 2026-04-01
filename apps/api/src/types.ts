import type { Database } from './db/client.js';

export interface ApiError {
  error: {
    code: string;    // machine-readable: 'VALIDATION_ERROR', 'NOT_FOUND', 'INTERNAL_ERROR'
    message: string; // human-readable description
    details?: unknown; // optional structured details (e.g., Zod validation errors)
  };
}

export type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  API_TOKEN: string;
  CLERK_ISSUER_URL?: string;
  RESEND_API_KEY: string;
  GSP_API_KEY?: string;
  GSP_BASE_URL?: string;
  PLATFORM_LEGAL_NAME?: string;
  PLATFORM_ADDRESS1?: string;
  PLATFORM_CITY?: string;
  PLATFORM_PINCODE?: string;
  PLATFORM_GSTIN?: string;
};

export type Variables = {
  db: Database;
  tenantId: string | null;
  authType: 'clerk' | 'api_token';
  orgRole: string | null;
  platformAdmin: boolean;
  irpCtx: { waitUntil(p: Promise<unknown>): void };
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
