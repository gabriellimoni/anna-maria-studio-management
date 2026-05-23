import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) return null;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
