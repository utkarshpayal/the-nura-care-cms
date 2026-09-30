import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { CmsProvider, canRead, useAuth, useCms } from "./lib/store";
import { AppLayout, ErrorState, Loading } from "./components/ui";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { LayoutPage } from "./pages/LayoutPage";
import { BannersPage } from "./pages/BannersPage";
import { ThemePage } from "./pages/ThemePage";
import { SettingsPage } from "./pages/SettingsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { CycleSyncPage } from "./pages/CycleSyncPage";
import { LaunchesPage } from "./pages/LaunchesPage";
import { UsagePage } from "./pages/UsagePage";

/** Pages only render once the config has loaded, so they can assume it's there. */
const Loaded: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, loading, error, reload } = useCms();
  if (loading) return <Loading text="Loading the app config…" />;
  if (error || !config) return <ErrorState text={error ?? "Couldn't load the app config."} onRetry={reload} />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { user, permissions, checking, logout } = useAuth();

  if (checking) return <Loading text="Checking your session…" />;
  if (!user) return <LoginPage />;
  if (!canRead(permissions)) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <ShieldOff size={28} />
          <h1>No access to the App CMS</h1>
          <p className="muted">Your role doesn't include the cms.read permission. Ask a Super Admin to change your role.</p>
          <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <CmsProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Loaded><OverviewPage /></Loaded>} />
          <Route path="features" element={<Loaded><FeaturesPage /></Loaded>} />
          <Route path="launches" element={<Loaded><LaunchesPage /></Loaded>} />
          <Route path="layout" element={<Loaded><LayoutPage /></Loaded>} />
          <Route path="home-layout" element={<Navigate to="/layout" replace />} />
          <Route path="usage" element={<Loaded><UsagePage /></Loaded>} />
          <Route path="banners" element={<Loaded><BannersPage /></Loaded>} />
          <Route path="era-tips" element={<Loaded><CycleSyncPage /></Loaded>} />
          <Route path="theme" element={<Loaded><ThemePage /></Loaded>} />
          <Route path="settings" element={<Loaded><SettingsPage /></Loaded>} />
          <Route path="history" element={<Loaded><HistoryPage /></Loaded>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CmsProvider>
  );
};
