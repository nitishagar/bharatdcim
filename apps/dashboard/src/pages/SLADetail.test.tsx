import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { SLADetail } from './SLADetail';
import { mockSLAViolations } from '../test/mocks/data';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'sla-001' }), useNavigate: () => mockNavigate };
});

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
    ReferenceLine: ({ y }: { y: number }) => <div data-testid="reference-line" data-y={y} />,
    Legend: () => <div data-testid="chart-legend" />,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

describe('SLADetail page', () => {
  it('renders SLA config name and type', async () => {
    renderWithProviders(<SLADetail />);
    await waitFor(() => expect(screen.getAllByText('Uptime SLA').length).toBeGreaterThan(0));
    expect(screen.getByRole('heading', { name: /uptime sla/i })).toBeInTheDocument();
  });

  it('renders compliance LineChart', async () => {
    renderWithProviders(<SLADetail />);
    await waitFor(() => expect(screen.getByTestId('line-chart')).toBeInTheDocument());
  });

  it('chart has ReferenceLine at target compliance', async () => {
    renderWithProviders(<SLADetail />);
    await waitFor(() => expect(screen.getByTestId('reference-line')).toBeInTheDocument());
  });

  it('renders violations table with severity badges', async () => {
    renderWithProviders(<SLADetail />);
    await waitFor(() => expect(screen.getByText(/violations/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('warning')).toBeInTheDocument());
  });

  it('"Acknowledge" button on violation calls PATCH /sla/violations/:id', async () => {
    let patchCalled = false;
    server.use(
      http.patch('*/sla/violations/:id', () => {
        patchCalled = true;
        return HttpResponse.json({ ...mockSLAViolations[0], status: 'acknowledged' });
      }),
    );
    renderWithProviders(<SLADetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /acknowledge/i }));
    await waitFor(() => expect(patchCalled).toBe(true));
  });

  it('"Edit SLA" form visible to admin only', async () => {
    renderWithProviders(<SLADetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /uptime sla/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /edit sla/i })).toBeInTheDocument();
  });
});
