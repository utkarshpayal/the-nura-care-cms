import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Orbit,
  Palette,
  Rocket,
  Rows3,
  RotateCcw,
  Save,
  Settings2,
  History,
  X,
  Loader2
} from "lucide-react";
import { useAuth } from "../lib/store";
import { staffName } from "../lib/catalog";

/* --------------------------------- Toasts -------------------------------- */

type Toast = { id: number; kind: "success" | "error"; text: string };
const ToastContext = createContext<(kind: Toast["kind"], text: string) => void>(() => undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = next.current++;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{t.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

/* --------------------------------- Layout -------------------------------- */

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/features", label: "Screens & features", icon: LayoutGrid },
  { to: "/launches", label: "Launches", icon: Rocket },
  { to: "/home-layout", label: "Home layout", icon: Rows3 },
  { to: "/banners", label: "Banners & ads", icon: Megaphone },
  { to: "/era-tips", label: "Your Era tips", icon: Orbit },
  { to: "/theme", label: "Theme", icon: Palette },
  { to: "/settings", label: "App settings", icon: Settings2 },
  { to: "/history", label: "History", icon: History }
];

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <span>The Nura Care</span>
            <strong>App CMS</strong>
          </div>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}>
              <Icon size={17} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <div>
            <strong>{staffName(user)}</strong>
            <span>{user?.access?.roleLabel ?? user?.role}</span>
          </div>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
};

export const PageHeader: React.FC<{ eyebrow?: string; title: string; children?: React.ReactNode; actions?: React.ReactNode }> = ({
  eyebrow,
  title,
  children,
  actions
}) => (
  <header className="page-head">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p className="lede">{children}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>
);

/* --------------------------------- Inputs -------------------------------- */

export const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  hideLabel?: boolean;
}> = ({ checked, onChange, label, disabled, hideLabel }) => (
  <label className={`switch ${disabled ? "is-disabled" : ""}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span className="switch-track" aria-hidden />
    <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
  </label>
);

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Save bar ------------------------------- */

/**
 * Sticky bar shown while a page has unsaved edits. Also warns before the tab
 * is closed with changes pending.
 */
export const SaveBar: React.FC<{
  dirty: boolean;
  saving: boolean;
  canManage: boolean;
  onSave: () => void;
  onDiscard: () => void;
  note?: string;
}> = ({ dirty, saving, canManage, onSave, onDiscard, note }) => {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!dirty) return null;
  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <span>{canManage ? note ?? "Unsaved changes — they go live in the app within a few minutes of saving." : "You can preview changes, but saving needs the cms.manage permission."}</span>
      <div>
        <button type="button" className="btn btn-ghost" onClick={onDiscard} disabled={saving}>
          <RotateCcw size={15} /> Discard
        </button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || !canManage}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Save & publish
        </button>
      </div>
    </div>
  );
};

export const Loading: React.FC<{ text?: string }> = ({ text = "Loading…" }) => (
  <div className="center-state">
    <Loader2 size={22} className="spin" />
    <p>{text}</p>
  </div>
);

export const ErrorState: React.FC<{ text: string; onRetry?: () => void }> = ({ text, onRetry }) => (
  <div className="center-state">
    <AlertCircle size={22} />
    <p>{text}</p>
    {onRetry && (
      <button type="button" className="btn btn-ghost" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);
