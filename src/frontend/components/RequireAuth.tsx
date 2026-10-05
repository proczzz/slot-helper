import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { isLoggedIn } from '../lib/admin.ts';

export function RequireAuth() {
  const [auth, setAuth] = useState<'checking' | 'authorized' | 'unauthorized' | 'failed'>(
    'checking',
  );

  useEffect(() => {
    isLoggedIn()
      .then((ok) => setAuth(ok ? 'authorized' : 'unauthorized'))
      // fetch reject 代表連不到後端,不是沒登入,導去登入頁只會再卡一次
      .catch(() => setAuth('failed'));
  }, []);

  if (auth === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (auth === 'failed') {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="alert alert-error">連不到伺服器，請確認後端是否已啟動。</div>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            重新載入
          </button>
        </div>
      </div>
    );
  }

  if (auth === 'unauthorized') return <Navigate to="/login" replace />;

  return <Outlet />;
}
