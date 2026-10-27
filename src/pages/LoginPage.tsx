import React, { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { backendLabel, errorMessage, isApiConfigured, resendLoginCode, type LoginChallenge } from "../lib/api";
import { useAuth } from "../lib/store";

export const LoginPage: React.FC = () => {
  const { login, verifyCode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Second step: the code emailed after the password (backend STAFF_2FA_ENABLED).
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await login(email.trim(), password);
      if (next) {
        setChallenge(next);
        setCode("");
        setInfo(null);
      }
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed."));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setInfo(null);
    const totp = challenge.method === "totp";
    // Authenticator users may type a recovery code (xxxxx-xxxxx) instead.
    if (totp ? code.trim().length < 6 : !/^\d{6}$/.test(code.trim())) {
      setError(totp ? "Enter the 6-digit code from your authenticator app." : "Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    try {
      await verifyCode(challenge.challengeToken, code.trim());
    } catch (err) {
      setError(errorMessage(err, "That code didn't work."));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    setError(null);
    try {
      setInfo(await resendLoginCode(challenge.challengeToken));
    } catch (err) {
      setError(errorMessage(err, "Couldn't send a new code."));
    }
  };

  const startOver = () => {
    setChallenge(null);
    setCode("");
    setPassword("");
    setError(null);
    setInfo(null);
  };

  if (challenge) {
    const totp = challenge.method === "totp";
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={submitCode}>
          <img src="/logo.png" alt="" className="auth-logo" />
          <h1>{totp ? "Enter your code" : "Check your email"}</h1>
          <p className="muted">
            {totp
              ? "Open your authenticator app and enter the 6-digit code for The Nura. Lost your phone? Use a recovery code."
              : `We sent a 6-digit code to ${challenge.sentTo || "your work email"}.`}
          </p>
          {info && !error && <p className="notice small">{info}</p>}
          {error && (
            <p className="notice notice-error small" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            <span>Sign-in code</span>
            <input
              inputMode={totp ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={totp ? 11 : 6}
              placeholder={totp ? "123456 or recovery code" : undefined}
              value={code}
              onChange={(e) => setCode(totp ? e.target.value : e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />} Sign in
          </button>
          <p className="muted small">
            {!totp && (
              <>
                <button type="button" className="btn-link" onClick={resend}>
                  Send a new code
                </button>
                {" · "}
              </>
            )}
            <button type="button" className="btn-link" onClick={startOver}>
              Use a different account
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/logo.png" alt="" className="auth-logo" />
        <h1>Nura App CMS {backendLabel() && <em className="env-pill">{backendLabel()}</em>}</h1>
        <p className="muted">Sign in with your Admin Workspace staff account.</p>
        {!isApiConfigured() && <p className="notice notice-warn small">No backend set (VITE_APP_ENV or VITE_API_BASE_URL). Copy .env.example to .env.</p>}
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
