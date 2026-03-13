import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import { usePlatformAdmin } from './usePlatformAdmin';

describe('usePlatformAdmin', () => {
  it('returns true when sessionClaims.platformAdmin is boolean true', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      sessionClaims: { platformAdmin: true },
    } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePlatformAdmin());
    expect(result.current).toBe(true);
  });

  it('returns true when sessionClaims.platformAdmin is string "true"', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      sessionClaims: { platformAdmin: 'true' },
    } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePlatformAdmin());
    expect(result.current).toBe(true);
  });

  it('returns false when sessionClaims.platformAdmin is false', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePlatformAdmin());
    expect(result.current).toBe(false);
  });

  it('returns false when sessionClaims is null', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      sessionClaims: null,
    } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePlatformAdmin());
    expect(result.current).toBe(false);
  });

  it('returns false when platformAdmin field is absent', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      sessionClaims: {},
    } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => usePlatformAdmin());
    expect(result.current).toBe(false);
  });
});
