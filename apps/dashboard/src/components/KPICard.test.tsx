import { render, screen } from '@testing-library/react';
import { KPICard } from './KPICard';

describe('KPICard', () => {
  it('renders label, value, and icon', () => {
    render(<KPICard label="Total Meters" value={5} icon="⚡" />);
    expect(screen.getByText('Total Meters')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('renders unit when provided', () => {
    render(<KPICard label="Consumption" value={1250} unit="kWh" icon="🔋" />);
    expect(screen.getByText('kWh')).toBeInTheDocument();
  });

  it('omits unit element when not provided', () => {
    render(<KPICard label="Bills" value={3} icon="₹" />);
    // Only the label and value should render, no unit text
    expect(screen.queryByText('kWh')).not.toBeInTheDocument();
    expect(screen.queryByText('kVA')).not.toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<KPICard label="Agents" value="1/2" icon="🔌" />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });
});
