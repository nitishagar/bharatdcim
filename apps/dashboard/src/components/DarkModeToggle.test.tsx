import { render, fireEvent } from '@testing-library/react';
import { DarkModeToggle } from './DarkModeToggle';

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('theme');
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('theme');
});

describe('DarkModeToggle', () => {
  it('renders a button with an accessible aria-label', () => {
    const { getByRole } = render(<DarkModeToggle />);
    const btn = getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label');
  });

  it('initially shows "Switch to dark mode" label when not in dark mode', () => {
    const { getByRole } = render(<DarkModeToggle />);
    expect(getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('clicking toggles dark class on document.documentElement', () => {
    const { getByRole } = render(<DarkModeToggle />);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('clicking again removes dark class', () => {
    const { getByRole } = render(<DarkModeToggle />);
    fireEvent.click(getByRole('button')); // → dark
    fireEvent.click(getByRole('button')); // → light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists "dark" to localStorage when dark mode activated', () => {
    const { getByRole } = render(<DarkModeToggle />);
    fireEvent.click(getByRole('button'));
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('persists "light" to localStorage when dark mode deactivated', () => {
    const { getByRole } = render(<DarkModeToggle />);
    fireEvent.click(getByRole('button')); // → dark
    fireEvent.click(getByRole('button')); // → light
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('when starting in dark mode, shows "Switch to light mode" label', () => {
    document.documentElement.classList.add('dark');
    const { getByRole } = render(<DarkModeToggle />);
    expect(getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});
