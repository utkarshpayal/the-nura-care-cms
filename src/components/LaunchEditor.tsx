import React, { useState } from "react";
import { Bell, MousePointerClick, X } from "lucide-react";
import type { ActionType, Launch, LaunchHeadline } from "../lib/api";
import {
  DEFAULT_PAUSED_MESSAGE,
  DEFAULT_PAUSED_TITLE,
  HEADLINE_LABEL,
  LAUNCH_STATES,
  LAUNCH_STATE_LABEL,
  MAX_TESTERS,
  RECIPES,
  ROLLOUT_STEPS,
  fromLocalInput,
  isTesterInput,
  launchError,
  formatWhen,
  toLocalInput,
  withState
} from "../lib/launch";
import { ActionEditor, AudienceEditor } from "./editors";
import { Segmented, Switch } from "./ui";

const ALL_ACTIONS: ActionType[] = ["none", "route", "url", "app"];

/**
 * The Launch fieldset in a feature or link tile's editor (docs/launch-states.md
 * §5.1): who can use it right now, and what everyone else sees. `saved` is
 * the published state, so a date saved earlier isn't flagged as past.
 */
export const LaunchEditor: React.FC<{
  value: Launch;
  saved?: Launch;
  onChange: (l: Launch) => void;
  /** Tile description, shown as the message placeholder (the app's fallback). */
  description: string;
  stats?: { waiting: number; lockedTaps: number };
}> = ({ value: l, saved, onChange, description, stats }) => {
  const setSoon = (patch: Partial<Launch["soon"]>) => onChange({ ...l, soon: { ...l.soon, ...patch } });
  const setRollout = (patch: Partial<Launch["rollout"]>) => onChange({ ...l, rollout: { ...l.rollout, ...patch } });
  const setPaused = (patch: Partial<Launch["paused"]>) => onChange({ ...l, paused: { ...l.paused, ...patch } });
  const err = launchError(l, saved);
  const showSoonSheet = l.state === "coming_soon" || (l.state === "rolling_out" && l.rollout.othersSee === "coming_soon");

  return (
    <fieldset className="audience launch-edit">
      <legend>Launch</legend>

      <div className="field">
        <span>Quick start</span>
        <div className="chip-row">
          {RECIPES.map((r) => (
            <button key={r.id} type="button" className="chip" onClick={() => onChange(r.apply(l))}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <Segmented label="Launch state" value={l.state} onChange={(s) => onChange(withState(l, s))} options={LAUNCH_STATES} />

      {l.state === "live" && <small className="muted">Everyone in the audience below can use it.</small>}

      {l.state === "rolling_out" && (
        <div className="launch-block">
          <div className="field">
            <span>
              Give it to <strong className="launch-percent">{l.rollout.percent}%</strong> of users
            </span>
            <input type="range" min={0} max={100} step={1} value={l.rollout.percent} onChange={(e) => setRollout({ percent: Number(e.target.value) })} aria-label="Rollout percentage" />
            <div className="chip-row">
              {ROLLOUT_STEPS.map((p) => (
                <button key={p} type="button" className={`chip ${l.rollout.percent === p ? "is-active" : ""}`} onClick={() => setRollout({ percent: p })}>
                  {p}%
                </button>
              ))}
            </div>
            <small className="muted">The same people stay in as you raise it; raising the % only adds people.</small>
          </div>
          <AudienceEditor
            legend="Only for"
            hint="Limits the rollout slice. Leave on Everyone for a plain percentage."
            value={l.rollout.audience}
            onChange={(audience) => setRollout({ audience })}
          />
          <div className="field">
            <span>Everyone else</span>
            <Segmented
              label="What everyone else sees"
              value={l.rollout.othersSee}
              onChange={(othersSee) => setRollout({ othersSee })}
              options={[
                { value: "coming_soon", label: "Sees Coming soon" },
                { value: "hidden", label: "Sees nothing" }
              ]}
            />
          </div>
          <Switch checked={l.rollout.betaLabel} onChange={(betaLabel) => setRollout({ betaLabel })} label="Show a BETA label to people who have it" />
        </div>
      )}

      {showSoonSheet && (
        <div className="launch-block">
          {l.state === "rolling_out" && <p className="launch-sub">Coming soon sheet, for everyone else</p>}
          <div className="field-row">
            <label className="field">
              <span>Headline</span>
              <select value={l.soon.headline} onChange={(e) => setSoon({ headline: e.target.value as LaunchHeadline })}>
                {(Object.keys(HEADLINE_LABEL) as LaunchHeadline[]).map((h) => (
                  <option key={h} value={h}>
                    {HEADLINE_LABEL[h]}
                  </option>
                ))}
              </select>
            </label>
            {l.soon.headline === "custom" && (
              <label className="field">
                <span>Custom headline</span>
                <input value={l.soon.customHeadline ?? ""} maxLength={40} placeholder="e.g. Coming in October" onChange={(e) => setSoon({ customHeadline: e.target.value || null })} />
              </label>
            )}
          </div>
          <label className="field">
            <span>Message</span>
            <textarea rows={2} value={l.soon.message ?? ""} maxLength={160} placeholder={description || "One or two lines on what's coming"} onChange={(e) => setSoon({ message: e.target.value || null })} />
          </label>
          <div className="launch-notify">
            <Switch checked={l.soon.notifyMe} onChange={(notifyMe) => setSoon({ notifyMe })} label="Let people tap “Notify me”" />
            {stats && <StatLine stats={stats} />}
          </div>
          <label className="field">
            <span>Go live on (optional)</span>
            <input type="datetime-local" value={toLocalInput(l.soon.goLiveAt)} onChange={(e) => setSoon({ goLiveAt: fromLocalInput(e.target.value) })} />
            <small className="muted">Switches to Live automatically. People see it the next time their app refreshes.</small>
          </label>
        </div>
      )}

      {l.state === "paused" && (
        <div className="launch-block">
          <div className="field-row">
            <label className="field">
              <span>Title</span>
              <input value={l.paused.title ?? ""} maxLength={60} placeholder={DEFAULT_PAUSED_TITLE} onChange={(e) => setPaused({ title: e.target.value || null })} />
            </label>
            <label className="field">
              <span>Resume on (optional)</span>
              <input type="datetime-local" value={toLocalInput(l.paused.resumeAt)} onChange={(e) => setPaused({ resumeAt: fromLocalInput(e.target.value) })} />
            </label>
          </div>
          <label className="field">
            <span>Message</span>
            <textarea rows={2} value={l.paused.message ?? ""} maxLength={200} placeholder={DEFAULT_PAUSED_MESSAGE} onChange={(e) => setPaused({ message: e.target.value || null })} />
          </label>
          <p className="launch-sub">Instead, offer (optional)</p>
          <ActionEditor value={l.paused.alternative} allowed={ALL_ACTIONS} onChange={(alternative) => setPaused({ alternative })} />
          {l.paused.alternative.type !== "none" && (
            <label className="field">
              <span>Button label</span>
              <input value={l.paused.alternativeLabel ?? ""} maxLength={24} placeholder={l.paused.alternative.type === "route" ? "Go there instead" : "Get help another way"} onChange={(e) => setPaused({ alternativeLabel: e.target.value || null })} />
            </label>
          )}
          <small className="muted">
            Resume goes back to {l.resumeTo === "rolling_out" ? `Rolling out (${l.rollout.percent}%)` : "Live"}.
          </small>
        </div>
      )}

      {l.state !== "live" && stats && !showSoonSheet && <StatLine stats={stats} />}

      <TesterInput value={l.testers} onChange={(testers) => onChange({ ...l, testers })} />

      <div className="launch-foot">
        {l.since && saved?.state === l.state && (
          <span className="muted small">
            {LAUNCH_STATE_LABEL[l.state]} since {formatWhen(l.since)}
          </span>
        )}
        {err && <small className="warn">{err}</small>}
      </div>
    </fieldset>
  );
};

const StatLine: React.FC<{ stats: { waiting: number; lockedTaps: number } }> = ({ stats }) => (
  <span className="muted small launch-stats">
    <Bell size={11} /> {stats.waiting.toLocaleString()} waiting · <MousePointerClick size={11} /> {stats.lockedTaps.toLocaleString()} locked taps
  </span>
);

/** Emails or phone numbers of app users who always get the feature. */
const TesterInput: React.FC<{ value: Launch["testers"]; onChange: (t: Launch["testers"]) => void }> = ({ value, onChange }) => {
  const [text, setText] = useState("");
  const [bad, setBad] = useState<string | null>(null);

  const add = () => {
    const entries = text.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
    if (entries.length === 0) return;
    const invalid = entries.find((x) => !isTesterInput(x));
    if (invalid) return setBad(`“${invalid}” isn't an email or phone number`);
    const known = new Set(value.map((t) => t.label.toLowerCase()));
    const fresh = entries.filter((x) => !known.has(x.toLowerCase())).map((label) => ({ id: null, label }));
    if (value.length + fresh.length > MAX_TESTERS) return setBad(`At most ${MAX_TESTERS} testers`);
    onChange([...value, ...fresh]);
    setText("");
    setBad(null);
  };

  return (
    <div className="field">
      <span>Testers — always get it, in every state</span>
      <div className="tester-box">
        {value.map((t) => (
          <span key={t.id ?? t.label} className={`tester-chip ${t.id ? "" : "is-new"}`} title={t.id ? "App user" : "Checked when you save"}>
            {t.label}
            <button type="button" aria-label={`Remove ${t.label}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={text}
          placeholder={value.length ? "Add another" : "priya@thenura.care or +91…"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          aria-label="Add a tester"
        />
      </div>
      {bad ? <small className="warn">{bad}</small> : <small className="muted">App users' emails or phone numbers. Press Enter to add.</small>}
    </div>
  );
};
