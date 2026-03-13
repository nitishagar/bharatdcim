import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { RequirePlatformAdmin } from './RequirePlatformAdmin';

vi.mock('../hooks/usePlatformAdmin');
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

describe('RequirePlatformAdmin', () => {
  it('renders children when usePlatformAdmin returns true', () => {
    vi.mocked(usePlatformAdmin).mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/platform']}>
        <RequirePlatformAdmin>
          <div>Platform Content</div>
        </RequirePlatformAdmin>
      </MemoryRouter>,
    );
    expect(screen.getByText('Platform Content')).toBeInTheDocument();
  });

  it('redirects to / when usePlatformAdmin returns false', () => {
    vi.mocked(usePlatformAdmin).mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/platform']}>
        <Routes>
          <Route
            path="/platform"
            element={
              <RequirePlatformAdmin>
                <div>Platform Content</div>
              </RequirePlatformAdmin>
            }
          />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Platform Content')).not.toBeInTheDocument();
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });
});
