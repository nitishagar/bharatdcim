import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './server';
import { setTokenGetter } from '../api/client';

// Provide a mock token so requireToken() never throws in tests
setTokenGetter(() => Promise.resolve('mock-test-token'));

// Mock @clerk/clerk-react globally — all hooks/components return safe defaults
vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(() => ({
    orgRole: 'org:admin',
    isSignedIn: true,
    getToken: vi.fn(() => Promise.resolve('mock-test-token')),
    sessionClaims: { platformAdmin: false },
  })),
  useOrganization: vi.fn(() => ({
    organization: { id: 'org_test', name: 'Test Org' },
  })),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  RedirectToSignIn: () => null,
  OrganizationSwitcher: () => null,
  UserButton: () => null,
}));

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
