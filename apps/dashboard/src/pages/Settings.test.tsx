import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { Settings } from './Settings';

describe('Settings page', () => {
  it('renders the Settings heading', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the user email from Clerk mock', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders the user full name from Clerk mock', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows API connection status', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
