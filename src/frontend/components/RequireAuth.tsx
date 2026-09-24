import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { isLoggedIn } from '../lib/admin.ts';

export function RequireAuth() {
  const [auth, setAuth] = useState<'checking' | 'authorized' | 'unauthorized'>('checking');

  useEffect(() => {
    isLoggedIn().then((ok) => setAuth(ok ? 'authorized' : 'unauthorized'));
  }, []);

  if (auth === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (auth === 'unauthorized') return <Navigate to="/login" replace />;

  return <Outlet />;
}
