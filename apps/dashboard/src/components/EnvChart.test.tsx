import { render, screen } from '@testing-library/react';
import { EnvChart } from './EnvChart';

const mockReadings = [
  { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T10:00:00Z', tempCTenths: 235, humidityPctTenths: 450 },
  { id: 'er2', meterId: 'meter-001', timestamp: '2026-03-01T11:00:00Z', tempCTenths: 242, humidityPctTenths: 460 },
];

describe('EnvChart', () => {
  // ENV-UI-02: EnvChart renders chart container (not empty state) when readings present
  it('ENV-UI-02: renders chart container when readings are present', () => {
    const { container } = render(<EnvChart readings={mockReadings} />);
    // Should render the chart wrapper div, not the empty state
    expect(container.querySelector('.recharts-wrapper, [style*="height: 300px"]')).toBeInTheDocument();
    expect(screen.queryByText('No environmental data')).not.toBeInTheDocument();
  });

  // ENV-UI-03: EnvChart renders empty state when readings=[]
  it('ENV-UI-03: renders empty state when no readings', () => {
    render(<EnvChart readings={[]} />);
    expect(screen.getByText('No environmental data')).toBeInTheDocument();
  });
});
