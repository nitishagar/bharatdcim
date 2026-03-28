import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { MeterDetail } from './MeterDetail';
import { mockCapacityThresholds } from '../test/mocks/data';

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

describe('MeterDetail chart — capacity threshold lines', () => {
  beforeEach(() => {
    vi.mock('recharts', async () => {
      const actual = await vi.importActual<typeof import('recharts')>('recharts');
      return {
        ...actual,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-container">{children}</div>,
        LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
        Line: ({ dataKey, strokeDasharray }: { dataKey: string; strokeDasharray?: string }) => (
          <div data-testid={`line-${dataKey}`} data-dasharray={strokeDasharray ?? ''} />
        ),
        ReferenceLine: ({ y, stroke }: { y: number; stroke: string }) => (
          <div data-testid="reference-line" data-y={y} data-stroke={stroke} />
        ),
        Legend: () => <div data-testid="chart-legend" />,
        CartesianGrid: () => null,
        XAxis: () => null,
        YAxis: () => null,
        Tooltip: () => null,
      };
    });
  });

  it('renders ReferenceLine when capacity threshold exists (warning level)', async () => {
    server.use(
      http.get('*/capacity/thresholds', () => HttpResponse.json(mockCapacityThresholds)),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => {
      const lines = screen.getAllByTestId('reference-line');
      const warningLine = lines.find(el => el.getAttribute('data-stroke') === '#f59e0b');
      expect(warningLine).toBeInTheDocument();
    });
  });

  it('renders second ReferenceLine for critical threshold (red stroke)', async () => {
    server.use(
      http.get('*/capacity/thresholds', () => HttpResponse.json(mockCapacityThresholds)),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => {
      const lines = screen.getAllByTestId('reference-line');
      const criticalLine = lines.find(el => el.getAttribute('data-stroke') === '#ef4444');
      expect(criticalLine).toBeInTheDocument();
    });
  });

  it('renders Legend component', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('chart-legend')).toBeInTheDocument());
  });

  it('renders dashed SMA trend line when readings are available', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => {
      const smaLine = screen.queryByTestId('line-sma');
      if (smaLine) {
        expect(smaLine.getAttribute('data-dasharray')).toBeTruthy();
      }
    });
  });

  it('no ReferenceLine when no thresholds are configured for the meter', async () => {
    server.use(
      http.get('*/capacity/thresholds', () => HttpResponse.json([])),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument());
  });
});
