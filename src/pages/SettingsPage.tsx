import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Construction, Download, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  AppSettings,
  ApiError,
  errorMessage,
  saveSettings,
  ThemeMode,
  UPDATE_CTA_MAX_LENGTH,
  UPDATE_HIGHLIGHT_MAX_LENGTH,
  UPDATE_HIGHLIGHTS_MAX,
  UPDATE_PROMPT_ID,
  withSettingsDefaults
} from "../lib/api";
import { isConflict, useCms } from "../lib/store";
import { resolvePalette } from "../lib/catalog";
import { PageHeader, SaveBar, Segmented, Switch, useToast } from "../components/ui";
import { PhoneFrame, UpdateSheetPreview } from "../components/AppPreview";

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

const pad = (n: number) => String(n).padStart(2, "0");

/** A fresh prompt id like p-202610161430 (local time); seconds are added if it would repeat `current`. */
const newPromptId = (current: string | null) => {
  const d = new Date();
  const id = `p-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  return id === current ? `${id}${pad(d.getSeconds())}` : id;
};

const Counter: React.FC<{ value: string; max: number }> = ({ value, max }) => (
  <span className={`char-count ${value.length > max ? "is-over" : ""}`} aria-hidden>
    {value.length}/{max}
  </span>
);

export const SettingsPage: React.FC = () => {
  const { config, canManage, applySaved, reload } = useCms();
  const toast = useToast();
  // Older APIs may not send the newer update-prompt fields yet; fill in the backend's defaults.
  const saved = useMemo(() => withSettingsDefaults(config!.settings), [config]);
  const [draft, setDraft] = useState<AppSettings>(saved);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>("light");
  const palette = useMemo(() => resolvePalette(mode, config!.theme), [mode, config]);

  useEffect(() => setDraft(saved), [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const m = draft.maintenance;
  const u = draft.update;
  const edit = (fn: (d: AppSettings) => AppSettings) => {
    setServerError(null);
    setDraft(fn);
  };
  const setM = (patch: Partial<AppSettings["maintenance"]>) => edit((d) => ({ ...d, maintenance: { ...d.maintenance, ...patch } }));
  const setU = (patch: Partial<AppSettings["update"]>) => edit((d) => ({ ...d, update: { ...d.update, ...patch } }));
  const hasStore = Boolean(u.androidUrl || u.iosUrl);

  const setHighlight = (i: number, text: string) => setU({ highlights: u.highlights.map((h, j) => (j === i ? text : h)) });
  const moveHighlight = (i: number, by: -1 | 1) => {
    const next = [...u.highlights];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setU({ highlights: next });
  };
  const removeHighlight = (i: number) => setU({ highlights: u.highlights.filter((_, j) => j !== i) });
  const addHighlight = () => setU({ highlights: [...u.highlights, ""] });

  const showAgain = () => {
    const id = newPromptId(u.promptId);
    if (
      !window.confirm(
        `Show the update prompt again to everyone it applies to, including people who already closed it?\n\nThis sets a new prompt id (${id}). It takes effect when you Save & publish; each of those people then sees the prompt once more.`
      )
    )
      return;
    setU({ promptId: id });
  };

  const problem = (() => {
    if (m.enabled && !m.message.trim()) return "Add a maintenance message";
    for (const v of [u.minVersion, u.latestVersion]) if (v && !VERSION.test(v)) return "App versions look like 1.4.0";
    if (u.minVersion && u.latestVersion && cmp(u.minVersion, u.latestVersion) > 0) return "The minimum version can't be above the latest";
    for (const l of [u.androidUrl, u.iosUrl]) if (l && !HTTPS.test(l)) return "Store links must start with https://";
    if ((u.minVersion || u.latestVersion || u.forceShowAll) && !hasStore) return "Add at least one store link so people can update";
    if (u.ctaLabel.length > UPDATE_CTA_MAX_LENGTH) return `The button label can be at most ${UPDATE_CTA_MAX_LENGTH} characters`;
    if (u.highlights.filter((h) => h.trim()).length > UPDATE_HIGHLIGHTS_MAX) return `Add at most ${UPDATE_HIGHLIGHTS_MAX} "What's new" points`;
    if (u.highlights.some((h) => h.trim().length > UPDATE_HIGHLIGHT_MAX_LENGTH)) return `Each "What's new" point can be at most ${UPDATE_HIGHLIGHT_MAX_LENGTH} characters`;
    if (u.promptId && !UPDATE_PROMPT_ID.test(u.promptId)) return "Prompt id may only use letters, numbers, dots, dashes and underscores";
    return null;
  })();

  const handleSave = async () => {
    if (problem) return toast("error", problem);
    if (m.enabled && !saved.maintenance.enabled && !window.confirm("Turn on maintenance mode? Nobody can use the app until you turn it off.")) return;
    if (u.forceShowAll && !saved.update.forceShowAll && !window.confirm("Show the update prompt to every app user, whatever version they run?")) return;
    setSaving(true);
    setServerError(null);
    const payload: AppSettings = { ...draft, update: { ...u, highlights: u.highlights.map((h) => h.trim()).filter(Boolean) } };
    try {
      applySaved(await saveSettings(config!.sectionVersions.settings, payload));
      toast("success", "App settings published.");
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        await reload();
      } else {
        // A 400 is the server's validation message (e.g. "Add at least one store link…"): show it on the page.
        if (err instanceof ApiError && err.status === 400) setServerError(err.message);
        toast("error", errorMessage(err, "Couldn't save settings."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Production controls" title="App settings">
        App-wide switches for incidents and releases. They reach every user on their next config refresh (launch, return
        to the app, or pull-to-refresh on Home).
      </PageHeader>

      {saved.maintenance.enabled && (
        <div className="notice notice-error">
          <AlertTriangle size={16} />
          <div>
            <strong>Maintenance mode is ON.</strong> The app is blocked for everyone right now.
          </div>
        </div>
      )}

      {serverError && (
        <div className="notice notice-error" role="alert">
          <AlertCircle size={16} />
          <div>
            <strong>Not published.</strong> {serverError}
          </div>
        </div>
      )}

      <div className="with-preview">
        <div>
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
                  version people see the "Update available" sheet, once per prompt id (or per version). Leave empty to turn off.
                  The web build never shows these.
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

            <div className="update-prompt">
              <h3>Update prompt</h3>

              <div className="toggle-row">
                <Switch
                  checked={u.forceShowAll}
                  onChange={(forceShowAll) => setU({ forceShowAll })}
                  label="Show to all users (any version)"
                  disabled={!hasStore && !u.forceShowAll}
                />
                <p className="muted small">
                  Everyone on a store build sees the sheet once, even people already up to date: handy for announcing a release.
                  The latest version isn't needed for this.
                </p>
              </div>
              {!hasStore && (
                <div className={`notice ${u.forceShowAll ? "notice-error" : "notice-warn"}`}>
                  <AlertTriangle size={16} />
                  <div>
                    {u.forceShowAll ? "Add a Play Store or App Store link above, or turn this off: the server won't save it without one." : "Add a Play Store or App Store link above to show the prompt to all users."}
                  </div>
                </div>
              )}

              <div className="toggle-row">
                <Switch checked={u.dismissible} onChange={(dismissible) => setU({ dismissible })} label='Allow "Later"' />
                <p className="muted small">
                  Off hides "Later", so people below the latest version can only update. It never blocks anyone already up to date;
                  use the minimum version for a hard block.
                </p>
              </div>

              <label className="field">
                <span className="field-label-row">
                  <span>Button label</span>
                  <Counter value={u.ctaLabel} max={UPDATE_CTA_MAX_LENGTH} />
                </span>
                <input value={u.ctaLabel} maxLength={UPDATE_CTA_MAX_LENGTH} placeholder="Update now" onChange={(e) => setU({ ctaLabel: e.target.value })} />
              </label>

              <div className="field">
                <span className="field-label-row">
                  <span>What's new</span>
                  <span className="char-count">
                    {u.highlights.length}/{UPDATE_HIGHLIGHTS_MAX} points
                  </span>
                </span>
                {u.highlights.length > 0 && (
                  <ol className="highlight-list">
                    {u.highlights.map((h, i) => (
                      <li key={i}>
                        <input
                          value={h}
                          maxLength={UPDATE_HIGHLIGHT_MAX_LENGTH}
                          placeholder="e.g. Faster cycle predictions"
                          aria-label={`What's new point ${i + 1}`}
                          onChange={(e) => setHighlight(i, e.target.value)}
                        />
                        <Counter value={h} max={UPDATE_HIGHLIGHT_MAX_LENGTH} />
                        <button type="button" className="icon-btn sm" onClick={() => moveHighlight(i, -1)} disabled={i === 0} aria-label={`Move point ${i + 1} up`}>
                          <ArrowUp size={13} />
                        </button>
                        <button type="button" className="icon-btn sm" onClick={() => moveHighlight(i, 1)} disabled={i === u.highlights.length - 1} aria-label={`Move point ${i + 1} down`}>
                          <ArrowDown size={13} />
                        </button>
                        <button type="button" className="icon-btn sm danger" onClick={() => removeHighlight(i)} aria-label={`Remove point ${i + 1}`}>
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <div>
                  <button type="button" className="btn btn-ghost sm" onClick={addHighlight} disabled={u.highlights.length >= UPDATE_HIGHLIGHTS_MAX}>
                    <Plus size={14} /> Add point
                  </button>
                </div>
                <p className="muted small">
                  Up to {UPDATE_HIGHLIGHTS_MAX} short points, {UPDATE_HIGHLIGHT_MAX_LENGTH} characters each, shown as a checklist under the message. Empty
                  ones are dropped.
                </p>
              </div>

              <div className="prompt-id-row">
                <div>
                  <strong className="small">Prompt id</strong>{" "}
                  {u.promptId ? <code>{u.promptId}</code> : <span className="muted small">none: shown once per latest version</span>}
                  {u.promptId !== saved.update.promptId && <span className="pill pill-scheduled launch-pill">unsaved</span>}
                  <p className="muted small">People who closed the prompt don't see it again until the id changes.</p>
                </div>
                <div className="chip-row">
                  {u.promptId && (
                    <button type="button" className="btn-link small" onClick={() => setU({ promptId: null })}>
                      Use latest version
                    </button>
                  )}
                  {u.promptId !== saved.update.promptId && (
                    <button type="button" className="btn btn-ghost sm" onClick={() => setU({ promptId: saved.update.promptId })}>
                      <RotateCcw size={14} /> Undo
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost sm" onClick={showAgain}>
                    Show again to everyone
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="preview-col">
          <div className="preview-controls">
            <Segmented label="Preview mode" value={mode} onChange={setMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          <PhoneFrame palette={palette} label="Update prompt preview">
            <UpdateSheetPreview update={u} palette={palette} />
          </PhoneFrame>
          <p className="muted small">
            {u.forceShowAll ? "Shown to every app user" : u.latestVersion ? `Shown below v${u.latestVersion}` : "Off: set a latest version or show to all users"}
            {hasStore ? "" : " · needs a store link for the button"}
          </p>
        </aside>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        canManage={canManage}
        onSave={handleSave}
        onDiscard={() => {
          setServerError(null);
          setDraft(saved);
        }}
        note={problem ?? undefined}
      />
    </div>
  );
};
