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
  revokeSession,
  login as apiLogin,
  verifyLoginCode,
  SecondStepRequired,
  type LoginChallenge,
  onUnauthorized,
  setToken,
  withLaunches
} from "./api";

/* ---------------------------------- Auth --------------------------------- */

type AuthState = {
  user: StaffUser | null;
  permissions: string[];
  checking: boolean;
  /** Resolves to the emailed-code step when the backend asks for one. */
  login: (email: string, password: string) => Promise<LoginChallenge | null>;
  verifyCode: (challengeToken: string, code: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    // End the session on the server too; fire and forget.
    revokeSession();
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
    try {
      setUser(await apiLogin(email, password));
      return null;
    } catch (err) {
      if (err instanceof SecondStepRequired) return err.challenge;
      throw err;
    }
  }, []);

  const verifyCode = useCallback(async (challengeToken: string, code: string) => {
    setUser(await verifyLoginCode(challengeToken, code));
  }, []);

  const value = useMemo(
    () => ({ user, permissions: user?.access?.permissions ?? [], checking, login, verifyCode, logout }),
    [user, checking, login, verifyCode, logout]
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
  /** Refetch just the launch stats (after an announcement, say). */
  reloadStats: () => Promise<void>;
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

  const reloadStats = useCallback(
    () =>
      getLaunchStats()
        .then((r) => setLaunchStats(r.stats ?? {}))
        .catch(() => undefined),
    []
  );

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [c, b] = await Promise.all([getConfig(), listBanners()]);
      setConfig(c);
      setBanners(b.banners);
      // Stats are extra: a failure here must not block the editors.
      reloadStats();
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the app config."));
    } finally {
      setLoading(false);
    }
  }, [reloadStats]);

  useEffect(() => {
    reload();
  }, [reload]);

  const applySaved = useCallback((saved: Partial<CmsConfig>) => {
    setConfig((c) => (c ? { ...c, ...withLaunches(saved) } : c));
  }, []);

  const value = useMemo(
    () => ({ config, banners, launchStats, loading, error, canManage: canManage(permissions), reload, reloadStats, applySaved, setBanners }),
    [config, banners, launchStats, loading, error, permissions, reload, reloadStats, applySaved]
  );
  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
};

export const useCms = () => {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error("useCms outside CmsProvider");
  return ctx;
};

export const isConflict = (err: unknown) => err instanceof ApiError && err.status === 409;
