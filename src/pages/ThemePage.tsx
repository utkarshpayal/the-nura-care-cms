import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ThemeMode, ThemeOverrides, errorMessage, saveTheme } from "../lib/api";
import { hubTitlesOf, isColor, resolvePalette, THEME_PRESETS, toHex6, TOKEN_GROUPS, tokenByKey } from "../lib/catalog";
import { isConflict, useCms } from "../lib/store";
import { HomeScreen, HubScreen, PhoneFrame } from "../components/AppPreview";
import { PageHeader, SaveBar, Segmented, useToast } from "../components/ui";

/* WCAG contrast, for the pairs that must stay readable. Only for opaque
   colours; rgba tints sit on a surface so they're skipped. */
const luminance = (hex: string) => {
  const h = toHex6(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const opaque = (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

const CHECKS: { fg: string; bg: string; label: string; min: number }[] = [
  { fg: "buttonText", bg: "button", label: "Button text on button", min: 4.5 },
  { fg: "text", bg: "background", label: "Body text on background", min: 4.5 },
  { fg: "mutedText", bg: "surface", label: "Muted text on cards", min: 4.5 },
  { fg: "foreground", bg: "surface", label: "Headings on cards", min: 4.5 },
  { fg: "primary", bg: "surface", label: "Primary as icon on cards", min: 3 }
];

const clean = (t: ThemeOverrides): ThemeOverrides => ({
  light: Object.fromEntries(Object.entries(t.light).filter(([, v]) => v)),
  dark: Object.fromEntries(Object.entries(t.dark).filter(([, v]) => v))
});
const same = (a: ThemeOverrides, b: ThemeOverrides) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

export const ThemePage: React.FC = () => {
  const { config, banners, canManage, applySaved, reload } = useCms();
  const toast = useToast();
  const [draft, setDraft] = useState<ThemeOverrides>(config!.theme);
  const [mode, setMode] = useState<ThemeMode>("light");
  const [screen, setScreen] = useState<"home" | "hub">("home");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(config!.theme), [config]);

  const tokens = tokenByKey(config!.catalog.themeTokens);
  const palette = useMemo(() => resolvePalette(mode, draft), [mode, draft]);
  const dirty = !same(draft, config!.theme);
  const overridden = Object.keys(clean(draft)[mode]).length;

  const setToken = (key: string, value: string) =>
    setDraft((d) => ({ ...d, [mode]: { ...d[mode], [key]: value } }));
  const resetToken = (key: string) =>
    setDraft((d) => {
      const next = { ...d[mode] };
      delete next[key];
      return { ...d, [mode]: next };
    });

  const invalid = (["light", "dark"] as ThemeMode[]).flatMap((m) =>
    Object.entries(draft[m]).filter(([, v]) => v && !isColor(v)).map(([k]) => `${m} ${tokens.get(k)?.label ?? k}`)
  );

  const failing = CHECKS.filter(
    (c) => opaque(palette[c.fg]) && opaque(palette[c.bg]) && contrast(palette[c.fg], palette[c.bg]) < c.min
  );

  const handleSave = async () => {
    if (invalid.length) return toast("error", `Fix the invalid colour: ${invalid[0]}.`);
    setSaving(true);
    try {
      applySaved(await saveTheme(config!.sectionVersions.theme, clean(draft)));
      toast("success", "Theme published. Users see it the next time the app refreshes its config.");
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        await reload();
      } else toast("error", errorMessage(err, "Couldn't save the theme."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Look & feel" title="Theme">
        Change the app's colours for light and dark mode. Anything you don't set keeps the app's built-in colour; error
        and warning colours are never changed from here.
      </PageHeader>

      <div className="with-preview">
        <div className="theme-editor">
          <section className="card">
            <h2 className="card-title">Start from a preset</h2>
            <div className="presets">
              {THEME_PRESETS.map((p) => {
                const pal = resolvePalette(mode, p.theme);
                return (
                  <button key={p.id} type="button" className="preset" onClick={() => setDraft(p.theme)} title={`Apply ${p.name} (both modes)`}>
                    <span className="preset-swatches">
                      {["primary", "secondary", "accent", "background"].map((k) => (
                        <i key={k} style={{ background: pal[k] }} />
                      ))}
                    </span>
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="muted small">A preset sets both light and dark mode. You can fine-tune any colour below.</p>
          </section>

          <section className="card">
            <div className="card-title-row">
              <h2 className="card-title">Colours</h2>
              <Segmented label="Mode" value={mode} onChange={setMode} options={[{ value: "light", label: "Light mode" }, { value: "dark", label: "Dark mode" }]} />
            </div>
            <p className="muted small">
              {overridden === 0 ? "Using the app's default colours for this mode." : `${overridden} colour${overridden === 1 ? "" : "s"} changed in ${mode} mode.`}
            </p>

            {TOKEN_GROUPS.map((g) => (
              <div key={g.title} className="token-group">
                <h3>{g.title}</h3>
                {g.keys.map((key) => {
                  const t = tokens.get(key);
                  if (!t) return null;
                  const value = draft[mode][key] ?? "";
                  const def = t[mode];
                  const bad = Boolean(value) && !isColor(value);
                  return (
                    <div key={key} className={`token-row ${value ? "is-set" : ""}`}>
                      <input
                        type="color"
                        value={toHex6(value || def)}
                        onChange={(e) => setToken(key, e.target.value)}
                        aria-label={`${t.label} colour picker`}
                      />
                      <div className="token-text">
                        <strong>{t.label}</strong>
                        <span className="muted small">Default {def}</span>
                      </div>
                      <input
                        className={`token-value ${bad ? "is-invalid" : ""}`}
                        value={value}
                        placeholder={def}
                        onChange={(e) => setToken(key, e.target.value)}
                        aria-label={`${t.label} value`}
                      />
                      <button type="button" className="icon-btn sm" onClick={() => resetToken(key)} disabled={!value} aria-label={`Reset ${t.label}`} title="Back to default">
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          {failing.length > 0 && (
            <div className="notice notice-warn">
              <AlertTriangle size={16} />
              <div>
                <strong>Hard to read in {mode} mode</strong>
                <ul>
                  {failing.map((c) => (
                    <li key={c.label}>
                      {c.label}: {contrast(palette[c.fg], palette[c.bg]).toFixed(1)}:1 (needs {c.min}:1)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <aside className="preview-col">
          <div className="preview-controls">
            <Segmented label="Screen" value={screen} onChange={setScreen} options={[{ value: "home", label: "Home" }, { value: "hub", label: "Hub" }]} />
            <Segmented label="Preview mode" value={mode} onChange={setMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          <PhoneFrame palette={palette}>
            {screen === "home" ? (
              <HomeScreen sections={config!.homeSections} hubTitles={hubTitlesOf(config!)} features={config!.features} links={config!.customTiles} banners={banners} palette={palette} mode={mode} />
            ) : (
              <HubScreen placement="care_hub" sections={config!.screenSections?.care_hub} title={config!.screenTitles?.care_hub?.title} features={config!.features} links={config!.customTiles} banners={banners} palette={palette} />
            )}
          </PhoneFrame>
        </aside>
      </div>

      <SaveBar dirty={dirty} saving={saving} canManage={canManage} onSave={handleSave} onDiscard={() => setDraft(config!.theme)} />
    </div>
  );
};
