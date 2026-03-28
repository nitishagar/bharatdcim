import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { PortalMeters } from './PortalMeters';

describe('PortalMeters (read-only)', () => {
  it('renders meters list', async () => {
    renderWithProviders(<PortalMeters />);
    await waitFor(() => expect(screen.getByText('Meters')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Main Grid Meter')).toBeInTheDocument());
  });

  it('does NOT render Create Meter button', async () => {
    renderWithProviders(<PortalMeters />);
    await waitFor(() => expect(screen.getByText('Main Grid Meter')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /create meter/i })).not.toBeInTheDocument();
  });
});
