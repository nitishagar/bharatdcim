import { useAuth } from '@clerk/clerk-react';

export function usePlatformAdmin(): boolean {
  const { sessionClaims } = useAuth();
  return (sessionClaims as Record<string, unknown> | null)?.platformAdmin === true
    || (sessionClaims as Record<string, unknown> | null)?.platformAdmin === 'true';
}
