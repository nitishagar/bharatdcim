import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Meters } from './Meters';

describe('Meters page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/meters', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Meters />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders meter list on data load', async () => {
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByText('Meters')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Main Grid Meter')).toBeInTheDocument());
    // Admin button visible since useIsAdmin returns true by default
    expect(screen.getByRole('button', { name: 'Create Meter' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/meters', () =>
        HttpResponse.json({ error: { message: 'Meters unavailable' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Meters />);
    await waitFor(() =>
      expect(screen.getByText('Meters unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no meters', async () => {
    server.use(http.get('*/meters', () => HttpResponse.json([])));
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByText('No meters found')).toBeInTheDocument());
  });
});

describe('Meters page – Create Meter form', () => {
  it('shows form when Create Meter button is clicked', async () => {
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Meter' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create Meter' }));
    expect(screen.getByPlaceholderText('e.g., Main Grid Meter')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., MH, KA, TN')).toBeInTheDocument();
  });

  it('hides form when Cancel is clicked', async () => {
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Meter' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create Meter' }));
    expect(screen.getByPlaceholderText('e.g., Main Grid Meter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('e.g., Main Grid Meter')).not.toBeInTheDocument();
  });

  it('submits valid form data and calls create meter API', async () => {
    let requestMade = false;
    server.use(
      http.post('*/meters', () => {
        requestMade = true;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Meter' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create Meter' }));
    const form = screen.getByPlaceholderText('e.g., Main Grid Meter').closest('form')!;
    fireEvent.change(screen.getByPlaceholderText('e.g., Main Grid Meter'), { target: { value: 'Test Meter' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., MH, KA, TN'), { target: { value: 'MH' } });
    fireEvent.change(form.querySelector('select[name="meterType"]')!, { target: { value: 'grid' } });
    fireEvent.submit(form);
    await waitFor(() => expect(requestMade).toBe(true));
  });
});

describe('Meters page – admin gating', () => {
  afterEach(() => {
    vi.mocked(useAuth).mockImplementation(() => ({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>));
  });

  it('hides Create Meter button for non-admin users', async () => {
    vi.mocked(useAuth).mockImplementation(() => ({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>));
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByText('Meters')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Create Meter' })).not.toBeInTheDocument();
  });
});
