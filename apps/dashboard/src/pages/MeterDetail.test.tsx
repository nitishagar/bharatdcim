import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { MeterDetail } from './MeterDetail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'meter-001' }), useNavigate: () => mockNavigate };
});

describe('MeterDetail page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/meters/:id', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<MeterDetail />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders meter details on data load', async () => {
    renderWithProviders(<MeterDetail />);
    // Heading and breadcrumb both render the name — use role to target h2
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    expect(screen.getByText('KA')).toBeInTheDocument();
    expect(screen.getByText('Readings')).toBeInTheDocument();
  });

  it('renders error message on meter fetch failure', async () => {
    server.use(
      http.get('*/meters/:id', () =>
        HttpResponse.json({ error: { message: 'Meter not found' } }, { status: 404 }),
      ),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByText('Meter not found')).toBeInTheDocument(),
    );
  });

  it('renders Edit Meter button when admin', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /edit meter/i })).toBeInTheDocument();
  });

  it('shows edit form when Edit Meter button is clicked', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /edit meter/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('hides edit form when Cancel is clicked', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /edit meter/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  it('shows Delete Meter button for admin and opens confirm dialog', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Meter' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  // ENV-UI-01: MeterDetail renders "Environmental" section heading when env data present
  it('ENV-UI-01: renders Environmental section heading', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Environmental')).toBeInTheDocument());
  });

  // ENV-UI-04: MeterDetail shows Temperature KPI with value from latest env reading (23.5°C)
  it('ENV-UI-04: shows Temperature KPI card from latest env reading', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/23\.5.*°C/)).toBeInTheDocument());
  });

  // ENV-UI-05: MeterDetail shows Humidity KPI (45.0%)
  it('ENV-UI-05: shows Humidity KPI card from latest env reading', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/45\.0.*%/)).toBeInTheDocument());
  });

  // ENV-UI-06: Temperature KPI has warning style when temp > 30°C
  it('ENV-UI-06: Temperature KPI has warning style when temp > 30°C', async () => {
    server.use(
      http.get('*/env-readings/latest', () => HttpResponse.json([
        { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T10:00:00Z', tempCTenths: 325, humidityPctTenths: 450 },
      ])),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/32\.5.*°C/)).toBeInTheDocument());
    // Warning style: the temperature container has warning class
    const tempText = screen.getByText(/32\.5.*°C/);
    const container = tempText.closest('[class*="warning"], [class*="red"], [class*="amber"]') ?? tempText.closest('[data-status="warning"]');
    expect(container).toBeInTheDocument();
  });

  // ENV-UI-07: AlertBanner renders when useAlerts returns active events
  it('ENV-UI-07: AlertBanner shown when active alerts exist', async () => {
    server.use(
      http.get('*/alerts', () => HttpResponse.json([
        { id: 'ae1', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 350, threshold: 300, severity: 'warning', triggeredAt: '2026-03-01T10:00:00Z', resolvedAt: null, createdAt: '2026-03-01T10:00:00Z' },
      ])),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  // ENV-UI-08: AlertBanner not rendered when no active alerts
  it('ENV-UI-08: AlertBanner not shown when no active alerts', async () => {
    renderWithProviders(<MeterDetail />); // default handler returns []
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  // ENV-UI-09: AlertBanner shows "2 active alerts"
  it('ENV-UI-09: AlertBanner shows count for 2 active alerts', async () => {
    server.use(
      http.get('*/alerts', () => HttpResponse.json([
        { id: 'ae1', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 350, threshold: 300, severity: 'warning', triggeredAt: '2026-03-01T10:00:00Z', resolvedAt: null, createdAt: '2026-03-01T10:00:00Z' },
        { id: 'ae2', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 360, threshold: 300, severity: 'warning', triggeredAt: '2026-03-01T11:00:00Z', resolvedAt: null, createdAt: '2026-03-01T11:00:00Z' },
      ])),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/2 active alerts/i)).toBeInTheDocument());
  });

  it('calls DELETE API and navigates to /meters on confirm', async () => {
    let deleted = false;
    server.use(http.delete('*/meters/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Meter' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Meter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/meters'));
  });
});
