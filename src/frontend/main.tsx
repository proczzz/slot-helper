import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AdminLayout } from './components/AdminLayout.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { AiSettingsPage } from './pages/AiSettingPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import './styles.css';
import { CalendarSettingsPage } from './pages/CalendarSettingsPage.tsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings/ai" element={<AiSettingsPage />} />
            <Route path="/settings/calendar" element={<CalendarSettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
