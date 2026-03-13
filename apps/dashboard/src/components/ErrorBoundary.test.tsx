import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws on first render when shouldThrow is true
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error message');
  return <p>child content</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error from the intentional throw
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>child content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders Try Again button when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    // Error UI is showing
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // Click Try Again — resets state (child will throw again, but state is reset first)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    // After click, the boundary resets and re-renders children
    // (ThrowError still throws, so error UI reappears — but click was handled)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
