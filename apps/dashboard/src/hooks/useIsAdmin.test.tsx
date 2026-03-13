import { renderHook } from '@testing-library/react';
import { useAuth } from '@clerk/clerk-react';
import { useIsAdmin } from './useIsAdmin';

describe('useIsAdmin', () => {
  it('returns true when orgRole is org:admin', () => {
    vi.mocked(useAuth).mockReturnValue({ orgRole: 'org:admin' } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(true);
  });

  it('returns false for org:member role', () => {
    vi.mocked(useAuth).mockReturnValue({ orgRole: 'org:member' } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });

  it('returns false when orgRole is undefined', () => {
    vi.mocked(useAuth).mockReturnValue({ orgRole: undefined } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useIsAdmin());
    expect(result.current).toBe(false);
  });
});
