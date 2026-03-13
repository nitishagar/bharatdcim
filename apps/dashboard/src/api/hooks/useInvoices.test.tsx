import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCreateInvoice, useCancelInvoice, useCreateCreditNote } from './useInvoices';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ─── useCreateInvoice ─────────────────────────────────────────────────────

describe('useCreateInvoice', () => {
  const input = {
    billId: 'bill-001',
    supplierGSTIN: '29ABCDE1234F1Z5',
    recipientGSTIN: '29XYZPQ9876A1Z3',
  };

  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Invoice created');
  });

  it('calls toast.error on failure', async () => {
    server.use(
      http.post('*/invoices', () =>
        HttpResponse.json({ error: { message: 'Bill already invoiced' } }, { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useCreateInvoice(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Bill already invoiced');
  });
});

// ─── useCancelInvoice ─────────────────────────────────────────────────────

describe('useCancelInvoice', () => {
  it('calls toast.success on successful cancellation', async () => {
    const { result } = renderHook(() => useCancelInvoice(), { wrapper });
    await act(async () => { result.current.mutate({ id: 'invoice-001', reason: 'Duplicate' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Invoice cancelled');
  });

  it('calls toast.error on failure', async () => {
    server.use(
      http.post('*/invoices/:id/cancel', () =>
        HttpResponse.json({ error: { message: 'Already cancelled' } }, { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useCancelInvoice(), { wrapper });
    await act(async () => { result.current.mutate({ id: 'invoice-001', reason: 'Dup' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Already cancelled');
  });
});

// ─── useCreateCreditNote ──────────────────────────────────────────────────

describe('useCreateCreditNote', () => {
  const input = { invoiceId: 'invoice-001', amountPaisa: 50000, reason: 'Overbilling' };

  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateCreditNote(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Credit note issued');
  });

  it('calls toast.error on failure', async () => {
    server.use(
      http.post('*/invoices/credit-notes', () =>
        HttpResponse.json({ error: { message: 'Amount exceeds invoice total' } }, { status: 400 }),
      ),
    );
    const { result } = renderHook(() => useCreateCreditNote(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Amount exceeds invoice total');
  });
});
