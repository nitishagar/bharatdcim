import { screen, waitFor, fireEvent } from '@testing-library/react';
const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Billing } from './Billing';

describe('Billing page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/bills', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<Billing />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders bill list and admin button on data load', async () => {
    renderWithProviders(<Billing />);
    await waitFor(() => expect(screen.getByText('Billing')).toBeInTheDocument());
    // The table should show the bill period
    await waitFor(() =>
      expect(screen.getByText(/2026-01-01/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Calculate Bill' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/bills', () =>
        HttpResponse.json({ error: { message: 'Billing service down' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<Billing />);
    await waitFor(() =>
      expect(screen.getByText('Billing service down')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no bills', async () => {
    server.use(http.get('*/bills', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<Billing />);
    await waitFor(() => expect(screen.getByText('No bills found')).toBeInTheDocument());
  });
});

describe('Billing page – Calculate Bill form', () => {
  it('shows form when Calculate Bill button is clicked', async () => {
    renderWithProviders(<Billing />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate Bill' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Calculate Bill' }));
    expect(screen.getByText('Period Start')).toBeInTheDocument();
    expect(screen.getByText('Period End')).toBeInTheDocument();
  });

  it('hides form when Cancel is clicked', async () => {
    renderWithProviders(<Billing />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate Bill' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Calculate Bill' }));
    expect(screen.getByText('Period Start')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Period Start')).not.toBeInTheDocument();
  });

  it('shows Meter select input in form', async () => {
    renderWithProviders(<Billing />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate Bill' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Calculate Bill' }));
    expect(screen.getByRole('option', { name: 'Select meter...' })).toBeInTheDocument();
  });
});

describe('Billing page – admin gating', () => {
  afterEach(() => {
    vi.mocked(useAuth).mockImplementation(() => ({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>));
  });

  it('hides Calculate Bill button for non-admin users', async () => {
    vi.mocked(useAuth).mockImplementation(() => ({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>));
    renderWithProviders(<Billing />);
    await waitFor(() => expect(screen.getByText('Billing')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Calculate Bill' })).not.toBeInTheDocument();
  });
});
