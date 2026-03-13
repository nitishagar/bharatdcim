import { screen, waitFor } from '@testing-library/react';
const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Agents } from './Agents';

describe('Agents page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/agents', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<Agents />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders agent list on data load', async () => {
    renderWithProviders(<Agents />);
    await waitFor(() =>
      expect(screen.getByText('SNMP Agents')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText('snmp-agent-dc1')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Auto-refreshes every 30s/)).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/agents', () =>
        HttpResponse.json({ error: { message: 'Agent service error' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Agents />);
    await waitFor(() =>
      expect(screen.getByText('Agent service error')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no agents', async () => {
    server.use(http.get('*/agents', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<Agents />);
    await waitFor(() =>
      expect(screen.getByText('No agents registered')).toBeInTheDocument(),
    );
  });
});
