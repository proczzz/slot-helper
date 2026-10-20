import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { ChannelMark, Icon } from './BrandMark.tsx';
import { logout } from '../lib/admin.ts';
import { APP_VERSION } from '../../version.ts';
import { REPO_URL, useLatestVersion } from '../hooks/use-latest-version.ts';

// channel 的是品牌單色標,其餘走 assets/icon/
const MENU: { to: string; label: string; end?: boolean; icon?: string; channel?: string }[] = [
  { to: '/', label: '總覽', end: true, icon: 'material/home' },
  { to: '/conversations', label: 'AI 記憶', icon: 'material/chat' },
  { to: '/settings/shop', label: '店家資訊', icon: 'material/description' },
  { to: '/settings/ai', label: 'AI 模型', icon: 'ai' },
  { to: '/settings/calendar', label: '日曆', icon: 'material/calendar' },
  { to: '/settings/line', label: 'LINE', channel: 'line' },
  { to: '/settings/whatsapp', label: 'WhatsApp', channel: 'whatsapp' },
  { to: '/settings/telegram', label: 'Telegram', channel: 'telegram' },
  { to: '/settings/system', label: '系統設定', icon: 'material/settings' },
  { to: '/settings/account', label: '帳號', icon: 'material/account' },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const latest = useLatestVersion();
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
        {/* 設定頁內容變長時整頁會捲動,頂欄要釘住才不會跟著消失 */}
        <div className="navbar sticky top-0 z-10 bg-base-100 shadow-sm">
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
        <aside className="flex min-h-full w-64 flex-col bg-base-100">
          <Link to="/" className="flex items-center gap-2 p-4" onClick={() => setOpen(false)}>
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span className="font-semibold">SlotHelper</span>
          </Link>

          <ul className="menu w-full gap-1 px-3">
            {MENU.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)}>
                  {item.channel ? (
                    <ChannelMark channel={item.channel} mono className="size-5" />
                  ) : (
                    <Icon name={item.icon!} className="size-5" />
                  )}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* mt-auto 把這排推到側邊欄底部 */}
          <div className="mt-auto flex flex-col gap-2 p-4 text-xs">
            <div className="flex items-center gap-3">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="link link-hover inline-flex items-center gap-1 opacity-60"
              >
                <Icon name="github" className="size-4" />
                GitHub
              </a>
              <a
                href={`${REPO_URL}/issues/new`}
                target="_blank"
                rel="noreferrer"
                className="link link-hover opacity-60"
              >
                回報問題
              </a>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`${REPO_URL}/releases`}
                target="_blank"
                rel="noreferrer"
                className="link link-hover opacity-60"
              >
                v{APP_VERSION}
              </a>
              {latest && (
                <a
                  href={latest.url}
                  target="_blank"
                  rel="noreferrer"
                  className="badge badge-primary badge-sm"
                >
                  新版 {latest.version}
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
