import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import type { ActionType, Audience, AudiencePlatform, AudienceSegment, TapAction } from "../lib/api";
import { ACTION_LABEL, APP_DESTINATIONS, APP_LINK_PRESETS, SEGMENT_LABEL } from "../lib/catalog";
import { ICONS } from "./AppPreview";

const VERSION = /^\d{1,4}(\.\d{1,4}){0,2}$/;
const PLATFORMS: { value: AudiencePlatform; label: string }[] = [
  { value: "android", label: "Android" },
  { value: "ios", label: "iPhone" },
  { value: "web", label: "Web" }
];

/* -------------------------------- Audience -------------------------------- */

/** One line describing an audience, for list rows. Empty for "everyone". */
export const describeAudience = (a: Audience) => {
  const parts: string[] = [];
  if (a.segment !== "all") parts.push(SEGMENT_LABEL[a.segment]);
  if (a.platforms.length) parts.push(a.platforms.map((p) => PLATFORMS.find((x) => x.value === p)?.label).join("/"));
  if (a.minAppVersion) parts.push(`v${a.minAppVersion}+`);
  if (a.maxAppVersion) parts.push(`≤ v${a.maxAppVersion}`);
  return parts.join(" · ");
};

export const audienceError = (a: Audience) => {
  if (a.minAppVersion && !VERSION.test(a.minAppVersion)) return "App versions look like 1.4.0";
  if (a.maxAppVersion && !VERSION.test(a.maxAppVersion)) return "App versions look like 1.4.0";
  return null;
};

export const AudienceEditor: React.FC<{ value: Audience; onChange: (a: Audience) => void; legend?: string; hint?: string }> = ({
  value,
  onChange,
  legend = "Who sees it",
  hint = "Older app builds that don't understand targeting show the item to everyone."
}) => {
  const set = (patch: Partial<Audience>) => onChange({ ...value, ...patch });
  const togglePlatform = (p: AudiencePlatform) =>
    set({ platforms: value.platforms.includes(p) ? value.platforms.filter((x) => x !== p) : [...value.platforms, p] });
  const err = audienceError(value);
  return (
    <fieldset className="audience">
      <legend>{legend}</legend>
      <div className="field-row">
        <label className="field">
          <span>People</span>
          <select value={value.segment} onChange={(e) => set({ segment: e.target.value as AudienceSegment })}>
            {(Object.keys(SEGMENT_LABEL) as AudienceSegment[]).map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Devices {value.platforms.length === 0 && <em className="muted">(all)</em>}</span>
          <div className="chip-row">
            {PLATFORMS.map((p) => (
              <button key={p.value} type="button" className={`chip ${value.platforms.includes(p.value) ? "is-active" : ""}`} aria-pressed={value.platforms.includes(p.value)} onClick={() => togglePlatform(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="field-row">
        <label className="field">
          <span>From app version</span>
          <input value={value.minAppVersion ?? ""} placeholder="any" onChange={(e) => set({ minAppVersion: e.target.value.trim() || null })} className={value.minAppVersion && !VERSION.test(value.minAppVersion) ? "is-invalid" : ""} />
        </label>
        <label className="field">
          <span>Up to app version</span>
          <input value={value.maxAppVersion ?? ""} placeholder="any" onChange={(e) => set({ maxAppVersion: e.target.value.trim() || null })} className={value.maxAppVersion && !VERSION.test(value.maxAppVersion) ? "is-invalid" : ""} />
        </label>
      </div>
      {err ? <small className="warn">{err}</small> : <small className="muted">{hint}</small>}
    </fieldset>
  );
};

/* --------------------------------- Actions -------------------------------- */

const SCHEME = /^([a-z][a-z0-9+.-]{1,31}):\/{0,2}\S+$/i;
const BLOCKED = new Set(["javascript", "data", "file", "vbscript", "blob", "about"]);

export const actionError = (a: TapAction) => {
  if (a.type === "none") return null;
  const v = a.value?.trim() ?? "";
  if (a.type === "route" && !/^\/(?!\/)\S*$/.test(v)) return "Pick the screen it opens";
  if (a.type === "url" && !/^https:\/\/\S+$/.test(v)) return "The website must start with https://";
  if (a.type === "app") {
    const m = SCHEME.exec(v);
    if (!m || BLOCKED.has(m[1].toLowerCase())) return "Enter the app's link, e.g. whatsapp://send?phone=…";
    if (a.fallbackUrl && !/^https:\/\/\S+$/.test(a.fallbackUrl)) return "The fallback must start with https://";
  }
  return null;
};

export const describeAction = (a: TapAction) =>
  a.type === "none" ? "No tap action" : a.type === "route" ? `Opens ${a.value}` : a.type === "url" ? `Website ${a.value}` : `App link ${a.value}`;

export const ActionEditor: React.FC<{ value: TapAction; onChange: (a: TapAction) => void; allowed: ActionType[] }> = ({ value, onChange, allowed }) => {
  const [customRoute, setCustomRoute] = useState(() => value.type === "route" && !APP_DESTINATIONS.some((d) => d.value === value.value));
  const set = (patch: Partial<TapAction>) => onChange({ ...value, ...patch });
  const err = actionError(value);

  return (
    <div className="action-editor">
      <label className="field">
        <span>On tap</span>
        <select
          value={value.type}
          onChange={(e) => {
            const type = e.target.value as ActionType;
            setCustomRoute(false);
            onChange({ type, value: type === "route" ? "/subscription" : type === "url" ? "https://" : type === "app" ? "" : null, fallbackUrl: null });
          }}
        >
          {allowed.map((t) => (
            <option key={t} value={t}>
              {ACTION_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      {value.type === "route" && (
        <label className="field">
          <span>Screen</span>
          <select
            value={customRoute ? "__custom" : value.value ?? ""}
            onChange={(e) => {
              if (e.target.value === "__custom") setCustomRoute(true);
              else {
                setCustomRoute(false);
                set({ value: e.target.value });
              }
            }}
          >
            {APP_DESTINATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
            <option value="__custom">Other screen (enter a path)…</option>
          </select>
          {customRoute && <input value={value.value ?? ""} placeholder="/blogs?slug=my-post" onChange={(e) => set({ value: e.target.value })} />}
        </label>
      )}

      {value.type === "url" && (
        <label className="field">
          <span>Website</span>
          <input value={value.value ?? ""} placeholder="https://thenura.care/offer" onChange={(e) => set({ value: e.target.value })} />
        </label>
      )}

      {value.type === "app" && (
        <>
          <div className="field">
            <span>Quick fill</span>
            <div className="chip-row">
              {APP_LINK_PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip" onClick={() => set({ value: p.value, fallbackUrl: p.fallbackUrl || null })}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>App link</span>
            <input value={value.value ?? ""} placeholder="whatsapp://send?phone=91XXXXXXXXXX" onChange={(e) => set({ value: e.target.value })} />
          </label>
          <label className="field">
            <span>If the app isn't installed, open (optional)</span>
            <input value={value.fallbackUrl ?? ""} placeholder="https://wa.me/91XXXXXXXXXX" onChange={(e) => set({ fallbackUrl: e.target.value.trim() || null })} />
          </label>
        </>
      )}
      {err && value.type !== "none" && <small className="warn">{err}</small>}
    </div>
  );
};

/* ---------------------------------- Icons --------------------------------- */

export const IconPicker: React.FC<{ value: string; icons: string[]; onChange: (icon: string) => void }> = ({ value, icons, onChange }) => (
  <div className="field">
    <span>Icon</span>
    <div className="icon-grid" role="radiogroup" aria-label="Icon">
      {icons.map((name) => {
        const Icon = ICONS[name] ?? Sparkles;
        return (
          <button key={name} type="button" role="radio" aria-checked={value === name} title={name.replace(/-outline$|^logo-/g, "")} className={`icon-choice ${value === name ? "is-active" : ""}`} onClick={() => onChange(name)}>
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  </div>
);
