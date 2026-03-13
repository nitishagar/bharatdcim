import { screen, waitFor, fireEvent } from '@testing-library/react';
const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Invoices } from './Invoices';

describe('Invoices page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/invoices', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<Invoices />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders invoice list and admin button on data load', async () => {
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByText('Invoices')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Generate Invoice' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/invoices', () =>
        HttpResponse.json({ error: { message: 'Invoices unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<Invoices />);
    await waitFor(() =>
      expect(screen.getByText('Invoices unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no invoices', async () => {
    server.use(http.get('*/invoices', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByText('No invoices found')).toBeInTheDocument());
  });
});

describe('Invoices page – Generate Invoice form', () => {
  it('shows form with two GSTIN fields when Generate Invoice is clicked', async () => {
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate Invoice' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Invoice' }));
    expect(screen.getAllByPlaceholderText('e.g., 29ABCDE1234F1Z5')).toHaveLength(2);
  });

  it('shows GSTIN validation error on submit with empty fields', async () => {
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate Invoice' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Invoice' }));
    const form = screen.getAllByPlaceholderText('e.g., 29ABCDE1234F1Z5')[0].closest('form')!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getAllByText(/Invalid GSTIN format/i).length).toBeGreaterThan(0),
    );
  });

  it('hides form when Cancel is clicked', async () => {
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate Invoice' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Invoice' }));
    expect(screen.getAllByPlaceholderText('e.g., 29ABCDE1234F1Z5')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('e.g., 29ABCDE1234F1Z5')).not.toBeInTheDocument();
  });
});

describe('Invoices page – admin gating', () => {
  afterEach(() => {
    vi.mocked(useAuth).mockImplementation(() => ({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>));
  });

  it('hides Generate Invoice button for non-admin users', async () => {
    vi.mocked(useAuth).mockImplementation(() => ({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>));
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByText('Invoices')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Generate Invoice' })).not.toBeInTheDocument();
  });
});
