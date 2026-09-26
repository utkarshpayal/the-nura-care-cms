import React, { useEffect, useState } from "react";
import { AlertTriangle, Construction, Download } from "lucide-react";
import { AppSettings, errorMessage, saveSettings } from "../lib/api";
import { isConflict, useCms } from "../lib/store";
import { PageHeader, SaveBar, Switch, useToast } from "../components/ui";

const VERSION = /^\d{1,4}(\.\d{1,4}){0,2}$/;
const HTTPS = /^https:\/\/\S+$/;

const cmp = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

export const SettingsPage: React.FC = () => {
  const { config, canManage, applySaved, reload } = useCms();
  const toast = useToast();
  const [draft, setDraft] = useState<AppSettings>(config!.settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(config!.settings), [config]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config!.settings);
  const m = draft.maintenance;
  const u = draft.update;
  const setM = (patch: Partial<AppSettings["maintenance"]>) => setDraft((d) => ({ ...d, maintenance: { ...d.maintenance, ...patch } }));
  const setU = (patch: Partial<AppSettings["update"]>) => setDraft((d) => ({ ...d, update: { ...d.update, ...patch } }));

  const problem = (() => {
    if (m.enabled && !m.message.trim()) return "Add a maintenance message";
    for (const v of [u.minVersion, u.latestVersion]) if (v && !VERSION.test(v)) return "App versions look like 1.4.0";
    if (u.minVersion && u.latestVersion && cmp(u.minVersion, u.latestVersion) > 0) return "The minimum version can't be above the latest";
    for (const l of [u.androidUrl, u.iosUrl]) if (l && !HTTPS.test(l)) return "Store links must start with https://";
    if ((u.minVersion || u.latestVersion) && !u.androidUrl && !u.iosUrl) return "Add at least one store link so people can update";
    return null;
  })();

  const handleSave = async () => {
    if (problem) return toast("error", problem);
    if (m.enabled && !config!.settings.maintenance.enabled && !window.confirm("Turn on maintenance mode? Nobody can use the app until you turn it off.")) return;
    setSaving(true);
    try {
      applySaved(await saveSettings(config!.sectionVersions.settings, draft));
      toast("success", "App settings published.");
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        await reload();
      } else toast("error", errorMessage(err, "Couldn't save settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page narrow">
      <PageHeader eyebrow="Production controls" title="App settings">
        App-wide switches for incidents and releases. They reach every user on their next config refresh (launch, return
        to the app, or pull-to-refresh on Home).
      </PageHeader>

      {config!.settings.maintenance.enabled && (
        <div className="notice notice-error">
          <AlertTriangle size={16} />
          <div>
            <strong>Maintenance mode is ON.</strong> The app is blocked for everyone right now.
          </div>
        </div>
      )}

      <section className="card settings-card">
        <header className="settings-head">
          <span className="settings-icon danger">
            <Construction size={18} />
          </span>
          <div>
            <h2>Maintenance mode</h2>
            <p className="muted small">Blocks the whole app with your message and a "Try again" button. Use during outages or risky migrations.</p>
          </div>
          <Switch checked={m.enabled} onChange={(enabled) => setM({ enabled })} label="Maintenance on" hideLabel />
        </header>
        <label className="field">
          <span>Title</span>
          <input value={m.title} maxLength={60} onChange={(e) => setM({ title: e.target.value })} />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea rows={3} value={m.message} maxLength={300} onChange={(e) => setM({ message: e.target.value })} />
        </label>
      </section>

      <section className="card settings-card">
        <header className="settings-head">
          <span className="settings-icon">
            <Download size={18} />
          </span>
          <div>
            <h2>Update prompts</h2>
            <p className="muted small">
              Below the <b>minimum</b> version the app is blocked until updated (force update). Below the <b>latest</b>{" "}
              version people see a dismissible "Update available" card, once per version. Leave empty to turn off. The web
              build never shows these.
            </p>
          </div>
        </header>
        <div className="field-row">
          <label className="field">
            <span>Minimum version (force update)</span>
            <input value={u.minVersion ?? ""} placeholder="e.g. 1.0.0 — empty = off" onChange={(e) => setU({ minVersion: e.target.value.trim() || null })} className={u.minVersion && !VERSION.test(u.minVersion) ? "is-invalid" : ""} />
          </label>
          <label className="field">
            <span>Latest version (soft prompt)</span>
            <input value={u.latestVersion ?? ""} placeholder="e.g. 1.2.0 — empty = off" onChange={(e) => setU({ latestVersion: e.target.value.trim() || null })} className={u.latestVersion && !VERSION.test(u.latestVersion) ? "is-invalid" : ""} />
          </label>
        </div>
        <label className="field">
          <span>Title</span>
          <input value={u.title} maxLength={60} onChange={(e) => setU({ title: e.target.value })} />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea rows={2} value={u.message} maxLength={300} onChange={(e) => setU({ message: e.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Play Store link</span>
            <input value={u.androidUrl ?? ""} placeholder="https://play.google.com/store/apps/details?id=…" onChange={(e) => setU({ androidUrl: e.target.value.trim() || null })} />
          </label>
          <label className="field">
            <span>App Store link</span>
            <input value={u.iosUrl ?? ""} placeholder="https://apps.apple.com/app/id…" onChange={(e) => setU({ iosUrl: e.target.value.trim() || null })} />
          </label>
        </div>
        <p className="muted small">The app compares these with its own version from app.json (currently shipped builds report theirs).</p>
      </section>

      <SaveBar dirty={dirty} saving={saving} canManage={canManage} onSave={handleSave} onDiscard={() => setDraft(config!.settings)} note={problem ?? undefined} />
    </div>
  );
};
