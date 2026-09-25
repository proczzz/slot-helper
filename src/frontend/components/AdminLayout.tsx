import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { logout } from '../lib/admin.ts';

const MENU = [
  { to: '/', label: '總覽', end: true },
  { to: '/settings/ai', label: 'AI 設定' },
  { to: '/settings/calendar', label: '日曆設定' },
  { to: '/settings/line', label: 'LINE 設定' },
];

export function AdminLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-dvh flex flex-col bg-base-200">
      <div className="navbar bg-base-100 shadow-sm">
        <Link to="/" className="flex-1 flex items-center gap-2 px-2">
          <img src="/icons8-helper-94.png" alt="" width={28} height={28} />
          <span className="font-semibold">SlotHelper 後台</span>
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={() => void handleLogout()}>
          登出
        </button>
      </div>

      <div className="flex flex-1">
        <aside className="w-56 bg-base-100 border-r border-base-300">
          <ul className="menu menu-lg w-full gap-1 p-3">
            <li className="menu-title">設定</li>
            {MENU.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
