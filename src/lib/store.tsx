import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  Banner,
  CMS_MANAGE,
  CMS_READ,
  CmsConfig,
  LaunchStats,
  StaffUser,
  errorMessage,
  getConfig,
  getLaunchStats,
  getMe,
  getToken,
  listBanners,
  login as apiLogin,
  onUnauthorized,
  setToken,
  withLaunches
} from "./api";

/* ---------------------------------- Auth --------------------------------- */

type AuthState = {
  user: StaffUser | null;
  permissions: string[];
  checking: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => onUnauthorized(logout), [logout]);

  // Restore a saved session; /api/admin/me also refreshes the permissions,
  // so a role change takes effect on the next page load.
  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then(({ user: u, access }) => setUser({ ...u, access }))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ user, permissions: user?.access?.permissions ?? [], checking, login, logout }),
    [user, checking, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
};

export const canRead = (perms: string[]) => perms.includes(CMS_READ) || perms.includes(CMS_MANAGE);
export const canManage = (perms: string[]) => perms.includes(CMS_MANAGE);

/* ------------------------------- CMS data -------------------------------- */

type CmsState = {
  config: CmsConfig | null;
  banners: Banner[];
  /** Notify me signups and locked taps per item key; empty until loaded (or on an older backend). */
  launchStats: LaunchStats;
  loading: boolean;
  error: string | null;
  canManage: boolean;
  reload: () => Promise<void>;
  /** Merge a save response (features/home/theme + new version) into the loaded config. */
  applySaved: (saved: Partial<CmsConfig>) => void;
  setBanners: React.Dispatch<React.SetStateAction<Banner[]>>;
};

const CmsContext = createContext<CmsState | null>(null);

export const CmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { permissions } = useAuth();
  const [config, setConfig] = useState<CmsConfig | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [launchStats, setLaunchStats] = useState<LaunchStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [c, b] = await Promise.all([getConfig(), listBanners()]);
      setConfig(c);
      setBanners(b.banners);
      // Stats are extra: a failure here must not block the editors.
      getLaunchStats()
        .then((r) => setLaunchStats(r.stats ?? {}))
        .catch(() => undefined);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the app config."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const applySaved = useCallback((saved: Partial<CmsConfig>) => {
    setConfig((c) => (c ? { ...c, ...withLaunches(saved) } : c));
  }, []);

  const value = useMemo(
    () => ({ config, banners, launchStats, loading, error, canManage: canManage(permissions), reload, applySaved, setBanners }),
    [config, banners, launchStats, loading, error, permissions, reload, applySaved]
  );
  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
};

export const useCms = () => {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error("useCms outside CmsProvider");
  return ctx;
};

export const isConflict = (err: unknown) => err instanceof ApiError && err.status === 409;
