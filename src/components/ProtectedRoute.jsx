import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, admin = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
        <p className="text-sm font-semibold text-navy-muted">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to={admin ? '/admin/login' : '/login'} replace />;
  if (admin && !isAdmin) return <Navigate to="/book" replace />;

  return children;
}
