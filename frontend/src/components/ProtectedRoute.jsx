// Phase 1: Preserve a requested destination while requiring a signed-in member.
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../context/useAuth.js';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <main className="auth-loading" aria-live="polite">Checking your account...</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
