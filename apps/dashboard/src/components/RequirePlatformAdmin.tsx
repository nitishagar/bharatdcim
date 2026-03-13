import { Navigate } from 'react-router-dom';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

export function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const isPlatformAdmin = usePlatformAdmin();
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
