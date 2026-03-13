import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the provided message', () => {
    render(<EmptyState message="No meters found" />);
    expect(screen.getByText('No meters found')).toBeInTheDocument();
  });

  it('renders different messages', () => {
    render(<EmptyState message="No invoices available" />);
    expect(screen.getByText('No invoices available')).toBeInTheDocument();
  });
});
