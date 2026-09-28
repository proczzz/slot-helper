import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { logout } from '../lib/admin.ts';

const MENU = [
  { to: '/', label: '總覽', end: true },
  { to: '/settings/prompt', label: 'AI 指示' },
  { to: '/settings/hours', label: '營業時間' },
  { to: '/settings/ai', label: 'AI 模型' },
  { to: '/settings/calendar', label: 'Google 日曆' },
  { to: '/settings/line', label: 'LINE' },
  { to: '/settings/account', label: '帳號' },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="drawer lg:drawer-open">
      <input
        id="admin-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={open}
        onChange={(event) => setOpen(event.target.checked)}
      />

      <div className="drawer-content flex min-h-dvh flex-col bg-base-200">
        <div className="navbar bg-base-100 shadow-sm">
          <label
            htmlFor="admin-drawer"
            className="btn btn-ghost btn-square lg:hidden"
            aria-label="開啟選單"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>

          <div className="flex-1 px-2 font-semibold">SlotHelper</div>

          <button className="btn btn-ghost btn-sm" onClick={() => void handleLogout()}>
            登出
          </button>
        </div>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <div className="drawer-side z-10">
        <label htmlFor="admin-drawer" className="drawer-overlay" aria-label="關閉選單" />
        <aside className="min-h-full w-64 bg-base-100">
          <Link to="/" className="flex items-center gap-2 p-4" onClick={() => setOpen(false)}>
            <img src="/icons8-helper-94.png" alt="" width={28} height={28} />
            <span className="font-semibold">SlotHelper</span>
          </Link>

          <ul className="menu w-full gap-1 px-3">
            {MENU.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
