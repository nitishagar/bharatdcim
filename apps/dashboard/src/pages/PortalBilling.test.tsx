import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { PortalBilling } from './PortalBilling';

describe('PortalBilling (read-only)', () => {
  it('renders bills list', async () => {
    renderWithProviders(<PortalBilling />);
    await waitFor(() => expect(screen.getByText('Bills')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('meter-001')).toBeInTheDocument());
  });

  it('does NOT render Calculate Bill button', async () => {
    renderWithProviders(<PortalBilling />);
    await waitFor(() => expect(screen.getByText('Bills')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /calculate bill/i })).not.toBeInTheDocument();
  });
});
