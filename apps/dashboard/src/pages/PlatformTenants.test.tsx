import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { PlatformTenants } from './PlatformTenants';
import { mockCreatedTenant } from '../test/mocks/data';

describe('PlatformTenants page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/platform/tenants', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<PlatformTenants />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders tenant list on data load', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByText('Tenants')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('DataCenter Corp')).toBeInTheDocument(),
    );
  });

  it('renders Create Tenant button', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Tenant' })).toBeInTheDocument());
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/platform/tenants', () =>
        HttpResponse.json({ error: { message: 'Tenants unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<PlatformTenants />);
    await waitFor(() =>
      expect(screen.getByText('Tenants unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no tenants', async () => {
    server.use(http.get('*/platform/tenants', () => HttpResponse.json([])));
    renderWithProviders(<PlatformTenants />);
    await waitFor(() =>
      expect(screen.getByText('No tenants found')).toBeInTheDocument(),
    );
  });

  it('shows create form when Create Tenant button is clicked', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Tenant' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create Tenant' }));
    expect(screen.getByText('New Tenant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Mumbai DC')).toBeInTheDocument();
  });

  it('hides create form when Cancel is clicked', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Tenant' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Create Tenant' }));
    expect(screen.getByText('New Tenant')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('New Tenant')).not.toBeInTheDocument();
  });

  it('submits create form and shows success', async () => {
    server.use(
      http.post('*/platform/tenants', () =>
        HttpResponse.json(mockCreatedTenant, { status: 201 }),
      ),
    );
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Tenant' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Create Tenant' }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Mumbai DC'), { target: { value: 'New DC' } });
    fireEvent.change(screen.getByPlaceholderText('e.g., MH, KA, TN'), { target: { value: 'DL' } });
    // Two "Create Tenant" buttons exist: the header button and the form submit button
    const createButtons = screen.getAllByRole('button', { name: 'Create Tenant' });
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('New Tenant')).not.toBeInTheDocument());
  });

  it('shows edit form when a tenant row is clicked', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByText('DataCenter Corp')).toBeInTheDocument());

    fireEvent.click(screen.getByText('DataCenter Corp'));
    await waitFor(() => expect(screen.getByText('Edit: DataCenter Corp')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('hides edit form when Cancel is clicked', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByText('DataCenter Corp')).toBeInTheDocument());

    fireEvent.click(screen.getByText('DataCenter Corp'));
    await waitFor(() => expect(screen.getByText('Edit: DataCenter Corp')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Edit: DataCenter Corp')).not.toBeInTheDocument();
  });
});
