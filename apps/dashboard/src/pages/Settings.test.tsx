import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { Settings } from './Settings';

describe('Settings page', () => {
  it('renders the Settings heading', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the organization name from Clerk mock', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Test Org')).toBeInTheDocument();
  });

  it('shows API connection section', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('API Connection')).toBeInTheDocument();
  });
});
