import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('applies draft styles', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText('draft')).toHaveClass('bg-gray-100', 'text-gray-700');
  });

  it('applies finalized styles', () => {
    render(<StatusBadge status="finalized" />);
    expect(screen.getByText('finalized')).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('applies invoiced styles', () => {
    render(<StatusBadge status="invoiced" />);
    expect(screen.getByText('invoiced')).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('applies cancelled styles', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('cancelled')).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('applies online styles', () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText('online')).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('falls back to gray for unknown status', () => {
    render(<StatusBadge status="unknown-status" />);
    expect(screen.getByText('unknown-status')).toHaveClass('bg-gray-100', 'text-gray-700');
  });
});
