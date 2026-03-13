import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';

// Polyfill ResizeObserver — required by Recharts' ResponsiveContainer in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
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
  useUser: vi.fn(() => ({
    user: {
      primaryEmailAddress: { emailAddress: 'test@example.com' },
      fullName: 'Test User',
    },
    isLoaded: true,
  })),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  RedirectToSignIn: () => null,
  OrganizationSwitcher: () => null,
  UserButton: () => null,
  UserProfile: () => null,
}));

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
