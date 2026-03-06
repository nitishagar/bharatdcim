import { HTTPException } from 'hono/http-exception';

/**
 * Requires the current user to be an org:admin or API_TOKEN user.
 * Throws 403 if the user is a member (read-only).
 */
export function requireAdmin(c: { get(key: 'orgRole'): string | null; get(key: 'authType'): 'clerk' | 'api_token' }): void {
  const authType = c.get('authType');
  // API_TOKEN requests (agents) are allowed to write
  if (authType === 'api_token') return;
  const role = c.get('orgRole');
  if (role !== 'admin') {
    throw new HTTPException(403, { message: 'Admin role required for this action' });
  }
}
