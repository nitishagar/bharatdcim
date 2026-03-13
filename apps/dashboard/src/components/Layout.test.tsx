import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/utils';
import { Layout } from './Layout';

vi.mock('../hooks/usePlatformAdmin');
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

function renderLayout(isPlatformAdmin = false) {
  vi.mocked(usePlatformAdmin).mockReturnValue(isPlatformAdmin);
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<div>Page Content</div>} />
      </Route>
    </Routes>,
  );
}

describe('Layout', () => {
  it('renders all standard nav links', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Meters/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Billing/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invoices/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Uploads/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agents/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tariffs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('renders hamburger button for mobile', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
  });

  it('hides platform nav items when not platform admin', () => {
    renderLayout(false);
    expect(screen.queryByRole('link', { name: /Platform Overview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tenants/i })).not.toBeInTheDocument();
  });

  it('shows platform nav items when user is platform admin', () => {
    renderLayout(true);
    expect(screen.getByRole('link', { name: /Platform Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tenants/i })).toBeInTheDocument();
  });

  it('renders outlet content', () => {
    renderLayout();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });
});
