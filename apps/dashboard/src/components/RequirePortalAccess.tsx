import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

/**
 * Allows both org:member and org:admin.
 * Redirects admins to / (admin dashboard) so they don't get stuck in portal.
 * Redirects unauthenticated users to sign-in.
 */
export function RequirePortalAccess({ children }: { children: React.ReactNode }) {
  const { orgRole, isSignedIn } = useAuth();

  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  // Admins who land on /portal get redirected to admin dashboard
  if (orgRole === 'org:admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}
