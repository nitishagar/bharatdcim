import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  it('renders all breadcrumb items', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Meters', to: '/meters' }, { label: 'Meter Detail' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Meters')).toBeInTheDocument();
    expect(screen.getByText('Meter Detail')).toBeInTheDocument();
  });

  it('renders a link for items with `to`', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Meters', to: '/meters' }, { label: 'Detail' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Meters' })).toHaveAttribute('href', '/meters');
  });

  it('renders last item as plain text without a link', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Meters', to: '/meters' }, { label: 'Detail' }]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Detail' })).not.toBeInTheDocument();
    expect(screen.getByText('Detail')).toBeInTheDocument();
  });

  it('renders a single item without separator', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Home', to: '/' }]} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });
});
