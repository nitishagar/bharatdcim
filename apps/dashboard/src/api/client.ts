export const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.bharatdcim.com';

// Token getter — wired from Clerk's useAuth().getToken via AuthBridge
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

async function requireToken(): Promise<string> {
  if (_getToken) {
    const token = await _getToken();
    if (token) return token;
  }
  throw new Error('Not authenticated. Please sign in again.');
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await requireToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `API error: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function uploadCSV(file: File): Promise<unknown> {
  const token = await requireToken();

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/uploads/csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}
