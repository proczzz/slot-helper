import { useNavigate } from 'react-router';
import { logout } from '../lib/admin.ts';

export function DashboardPage() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-base-200">
      <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1 flex items-center gap-2 px-2">
          <img src="/icons8-helper-94.png" alt="" width={28} height={28} />
          <span className="font-semibold">SlotHelper 後台</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void handleLogout()}>
          登出
        </button>
      </div>

      <main className="p-6">
        <p className="text-base-content/60">內容</p>
      </main>
    </div>
  );
}
