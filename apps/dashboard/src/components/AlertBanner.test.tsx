import { render, screen } from '@testing-library/react';
import { AlertBanner } from './AlertBanner';

const mockAlerts = [
  { id: 'ae1', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 350, threshold: 300, severity: 'warning', triggeredAt: '2026-03-01T10:00:00Z', resolvedAt: null, createdAt: '2026-03-01T10:00:00Z' },
  { id: 'ae2', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 360, threshold: 300, severity: 'warning', triggeredAt: '2026-03-01T11:00:00Z', resolvedAt: null, createdAt: '2026-03-01T11:00:00Z' },
];

describe('AlertBanner', () => {
  // ENV-UI-07: AlertBanner renders with alert count
  it('ENV-UI-07: renders alert count', () => {
    render(<AlertBanner alerts={mockAlerts} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/2 active alerts/i)).toBeInTheDocument();
  });

  // ENV-UI-08: AlertBanner not rendered when no alerts
  it('ENV-UI-08: not rendered when alerts is empty', () => {
    const { container } = render(<AlertBanner alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // ENV-UI-09: shows "2 active alerts" for 2 unresolved events
  it('ENV-UI-09: shows plural "alerts" for 2 events', () => {
    render(<AlertBanner alerts={mockAlerts} />);
    expect(screen.getByText(/2 active alerts/)).toBeInTheDocument();
  });

  it('shows singular "alert" for 1 event', () => {
    render(<AlertBanner alerts={[mockAlerts[0]]} />);
    expect(screen.getByText(/1 active alert[^s]/)).toBeInTheDocument();
  });
});
