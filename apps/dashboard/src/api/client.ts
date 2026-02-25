const API_BASE = import.meta.env.VITE_API_URL ?? 'https://bharatdcim-api.nitishagar.workers.dev';

export function getApiToken(): string | null {
  return localStorage.getItem('bharatdcim_api_token');
}

export function setApiToken(token: string): void {
  localStorage.setItem('bharatdcim_api_token', token);
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getApiToken();
  if (!token) throw new Error('API token not configured. Go to Settings.');

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

  return res.json() as Promise<T>;
}

export async function uploadCSV(file: File, tenantId: string): Promise<unknown> {
  const token = getApiToken();
  if (!token) throw new Error('API token not configured. Go to Settings.');

  const form = new FormData();
  form.append('file', file);
  form.append('tenantId', tenantId);

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
