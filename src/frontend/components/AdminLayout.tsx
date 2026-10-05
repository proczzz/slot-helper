import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { logout } from '../lib/admin.ts';

const MENU = [
  { to: '/', label: '總覽', end: true },
  { to: '/conversations', label: '對話紀錄' },
  { to: '/settings/shop', label: '店家資訊' },
  { to: '/settings/ai', label: 'AI 模型' },
  { to: '/settings/calendar', label: 'Google 日曆' },
  { to: '/settings/line', label: 'LINE' },
  { to: '/settings/account', label: '帳號' },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    // 後端連不到時也要清掉本地狀態並離開,所以不讓這個錯誤中斷流程
    await logout().catch((error) => console.error('登出請求失敗:', error));
    // 不清的話換帳號登入後,五分鐘內會看到前一個人快取的設定
    queryClient.clear();
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
