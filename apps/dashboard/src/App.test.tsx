import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createTestQueryClient } from './test/utils';
import { RoleBasedIndex } from './App';
import { RequirePortalAccess } from './components/RequirePortalAccess';
import { RequirePlatformAdmin } from './components/RequirePlatformAdmin';

function LocationDisplay() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

describe('RoleBasedIndex', () => {
  it('redirects org:member to /portal/meters', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>);

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={createTestQueryClient()}>
          <Routes>
            <Route path="/" element={<RoleBasedIndex />} />
            <Route path="/portal/meters" element={<LocationDisplay />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(getByTestId('location')).toHaveTextContent('/portal/meters');
  });
});

describe('Portal index redirect', () => {
  it('redirects /portal to /portal/meters', () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/portal']}>
        <Routes>
          <Route path="portal">
            <Route index element={<Navigate to="meters" replace />} />
            <Route path="meters" element={<LocationDisplay />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(getByTestId('location')).toHaveTextContent('/portal/meters');
  });
});

describe('RequirePortalAccess', () => {
  it('redirects org:admin to /', () => {
    // default mock already has orgRole: 'org:admin'
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/portal']}>
        <Routes>
          <Route path="/portal" element={<RequirePortalAccess><div>portal</div></RequirePortalAccess>} />
          <Route path="/" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );
    expect(getByTestId('location')).toHaveTextContent('/');
  });
});

describe('RequirePlatformAdmin', () => {
  it('redirects non-platform-admin to /', () => {
    // default mock has sessionClaims: { platformAdmin: false }
    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/platform']}>
        <Routes>
          <Route path="/platform" element={<RequirePlatformAdmin><div>platform</div></RequirePlatformAdmin>} />
          <Route path="/" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );
    expect(getByTestId('location')).toHaveTextContent('/');
  });
});
