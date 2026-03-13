import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { api, setTokenGetter } from './client';

describe('api client', () => {
  // Restore the default mock token after any test that overrides it
  afterEach(() => {
    setTokenGetter(() => Promise.resolve('mock-test-token'));
  });

  it('throws "Not authenticated" when token getter returns null', async () => {
    setTokenGetter(() => Promise.resolve(null));
    await expect(api('/meters')).rejects.toThrow('Not authenticated');
  });

  it('throws API error message from response body on non-ok response', async () => {
    server.use(
      http.get('*/meters', () =>
        HttpResponse.json({ error: { message: 'Forbidden' } }, { status: 403 }),
      ),
    );
    await expect(api('/meters')).rejects.toThrow('Forbidden');
  });

  it('falls back to generic "API error: <status>" when body has no error field', async () => {
    server.use(
      http.get('*/meters', () => new HttpResponse(null, { status: 500 })),
    );
    await expect(api('/meters')).rejects.toThrow('API error: 500');
  });

  it('resolves with parsed JSON on successful response', async () => {
    const result = await api<{ id: string }[]>('/meters');
    expect(Array.isArray(result)).toBe(true);
  });
});
