import type { Context } from 'hono';
import type { AppEnv } from '../types.js';

export interface PaginationOptions {
  hasPagination: boolean;
  limit: number;
  offset: number;
  search?: string;
}

/**
 * Parse limit/offset/search from query params.
 * When ?limit is absent, returns hasPagination=false for backward-compat
 * callers (SNMP agents, scripts) that expect a raw array response.
 */
export function parsePagination(c: Context<AppEnv>): PaginationOptions {
  const limitParam = c.req.query('limit');
  if (limitParam === undefined) {
    return { hasPagination: false, limit: 25, offset: 0 };
  }
  return {
    hasPagination: true,
    limit: Math.min(Math.max(1, parseInt(limitParam) || 25), 100),
    offset: Math.max(0, parseInt(c.req.query('offset') ?? '0') || 0),
    search: c.req.query('search') || undefined,
  };
}
