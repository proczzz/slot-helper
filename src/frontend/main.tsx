import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AdminLayout } from './components/AdminLayout.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { AiSettingsPage } from './pages/AiSettingPage.tsx';
import { BusinessHoursPage } from './pages/BusinessHoursPage.tsx';
import { CalendarSettingsPage } from './pages/CalendarSettingsPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LineSettingsPage } from './pages/LineSettingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { PromptSettingsPage } from './pages/PromptSettingsPage.tsx';
import './styles.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings/prompt" element={<PromptSettingsPage />} />
            <Route path="/settings/hours" element={<BusinessHoursPage />} />
            <Route path="/settings/ai" element={<AiSettingsPage />} />
            <Route path="/settings/calendar" element={<CalendarSettingsPage />} />
            <Route path="/settings/line" element={<LineSettingsPage />} />
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
