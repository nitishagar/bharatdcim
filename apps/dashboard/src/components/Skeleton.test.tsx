import { render } from '@testing-library/react';
import { Skeleton, TableSkeleton, DetailSkeleton, DashboardSkeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a div with animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-8 w-1/2" />);
    const el = container.querySelector('.animate-pulse');
    expect(el).toHaveClass('h-8', 'w-1/2');
  });
});

describe('TableSkeleton', () => {
  it('renders with data-testid loading-skeleton', () => {
    const { getByTestId } = render(<TableSkeleton />);
    expect(getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders default 5 row shimmer bars plus header', () => {
    const { container } = render(<TableSkeleton />);
    const bars = container.querySelectorAll('.animate-pulse');
    expect(bars.length).toBeGreaterThanOrEqual(5);
  });

  it('renders custom row count', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    // 1 header bar + 3 row bars = 4
    const bars = container.querySelectorAll('.animate-pulse');
    expect(bars.length).toBe(4);
  });
});

describe('DetailSkeleton', () => {
  it('renders with data-testid loading-skeleton', () => {
    const { getByTestId } = render(<DetailSkeleton />);
    expect(getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders multiple shimmer elements', () => {
    const { container } = render(<DetailSkeleton />);
    const bars = container.querySelectorAll('.animate-pulse');
    expect(bars.length).toBeGreaterThan(1);
  });
});

describe('DashboardSkeleton', () => {
  it('renders with data-testid loading-skeleton', () => {
    const { getByTestId } = render(<DashboardSkeleton />);
    expect(getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders 4 KPI card shimmer elements', () => {
    const { container } = render(<DashboardSkeleton />);
    const bars = container.querySelectorAll('.animate-pulse');
    expect(bars.length).toBe(4);
  });
});
