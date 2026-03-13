import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the error message text', () => {
    render(<ErrorMessage error={new Error('Something went wrong')} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows Retry button when onRetry is provided', () => {
    render(<ErrorMessage error={new Error('Network error')} onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('hides Retry button when onRetry is not provided', () => {
    render(<ErrorMessage error={new Error('Network error')} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('calls onRetry when Retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage error={new Error('Error')} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
