import { useAuth } from '@clerk/clerk-react';

export function useIsAdmin(): boolean {
  const { orgRole } = useAuth();
  return orgRole === 'org:admin';
}
