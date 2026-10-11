import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AdminLayout } from './components/AdminLayout.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { AiSettingsPage } from './pages/AiSettingPage.tsx';
import { CalendarSettingsPage } from './pages/CalendarSettingsPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LineSettingsPage } from './pages/LineSettingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ShopSettingsPage } from './pages/ShopSettingsPage.tsx';
import { SystemSettingsPage } from './pages/SystemSettingsPage.tsx';
import { TelegramSettingsPage } from './pages/TelegramSettingPage.tsx';
import { WhatsappSettingsPage } from './pages/WhatsappSettingPage.tsx';
import './styles.css';
import { ConversationsPage } from './pages/ConversationsPage.tsx';

// 後台讀的是設定檔,只有使用者自己送出才會變,所以快取不過期,一律靠 invalidateQueries 失效
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/settings/shop" element={<ShopSettingsPage />} />
            <Route path="/settings/ai" element={<AiSettingsPage />} />
            <Route path="/settings/calendar" element={<CalendarSettingsPage />} />
            <Route path="/settings/line" element={<LineSettingsPage />} />
            <Route path="/settings/telegram" element={<TelegramSettingsPage />} />
            <Route path="/settings/whatsapp" element={<WhatsappSettingsPage />} />
            <Route path="/settings/system" element={<SystemSettingsPage />} />
            <Route path="/settings/account" element={<AccountPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
