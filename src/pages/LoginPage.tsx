import React, { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { errorMessage, isApiConfigured } from "../lib/api";
import { useAuth } from "../lib/store";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/logo.png" alt="" className="auth-logo" />
        <h1>Nura App CMS</h1>
        <p className="muted">Sign in with your Admin Workspace staff account.</p>
        {!isApiConfigured() && <p className="notice notice-warn small">VITE_API_BASE_URL isn't set. Copy .env.example to .env.</p>}
        {error && (
          <p className="notice notice-error small" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Sign in
        </button>
      </form>
    </div>
  );
};
