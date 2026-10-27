import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Lock, Megaphone, RotateCcw } from "lucide-react";
import { EVERYONE, LAYOUT_SCREENS, LayoutScreen, ScreenSection, errorMessage, saveHomeSections, saveScreenSections } from "../lib/api";
import { PLACEMENT_LABEL, fromLocalInput, hubTitlesOf, resolvePalette, toLocalInput } from "../lib/catalog";
import { isConflict, useCms } from "../lib/store";
import { HomeScreen, HubScreen, PhoneFrame, ProfileScreen, liveBannersIn, tilesIn } from "../components/AppPreview";
import { AudienceEditor, audienceError, describeAudience } from "../components/editors";
import { PageHeader, SaveBar, Segmented, Switch, useToast } from "../components/ui";

type Screen = "home" | LayoutScreen;
const SCREENS: Screen[] = ["home", ...LAYOUT_SCREENS];
const TITLE_MAX = 30;

const SCREEN_LABEL: Record<Screen, string> = {
  home: "Home",
  profile: "Profile",
  care_hub: PLACEMENT_LABEL.care_hub,
  wellness_hub: PLACEMENT_LABEL.wellness_hub,
  explore_hub: PLACEMENT_LABEL.explore_hub
};

const HUB_HELP: Record<string, string> = {
  intro: "The one-line description under the hub's title.",
  promo: "Live banners placed on this hub.",
  tiles: "The features and link tiles placed on this hub."
};

const SECTION_HELP: Record<Screen, Record<string, string>> = {
  home: {
    statPills: "Streak and points counters under the greeting.",
    weekStrip: "This week's days with the cycle day marker.",
    promo_top: "Shows live banners placed in “Home — top slot”.",
    phaseHero: "The big cycle-phase card.",
    quickActions: "Log period / symptoms / mood buttons.",
    shortcuts: "Features and link tiles placed on Home. Hidden while empty.",
    promo_middle: "Shows live banners placed in “Home — middle slot”.",
    insights: "Cycle health and length trend carousel.",
    moreForYou: "Entry cards for the three hubs (a hub with no visible features is skipped)."
  },
  profile: {
    identity: "Photo, name, email and the Edit profile button.",
    completeProfile: "Asks for a photo or phone number. Only shows while one is missing.",
    stats: "Days tracked, care points and day streak.",
    account: "Achievements, subscription and government schemes.",
    preferences: "Notification, anonymous mode and Gen Z mode toggles.",
    privacyHelp: "App lock, data privacy and Help & support.",
    promo: "Live banners placed on Profile.",
    shortcuts: "Features and link tiles placed on Profile. Hidden while empty.",
    logout: "The Log out button."
  },
  care_hub: HUB_HELP,
  wellness_hub: HUB_HELP,
  explore_hub: HUB_HELP
};

/** The live-banner placement a promo block shows, for the "N live now" count. */
const promoPlacement = (screen: Screen, key: string) =>
  screen === "home" ? (key === "promo_top" ? "home_top" : key === "promo_middle" ? "home_middle" : null) : key === "promo" ? screen : null;

/**
 * Whether `key` is the block holding this screen's tiles. Which tiles are in
 * it, and how they look, is the Features & tiles page's job; this page only
 * links there.
 */
const isTileBlock = (screen: Screen, key: string) => key === (screen === "home" || screen === "profile" ? "shortcuts" : "tiles");

/** A block with every field filled, whatever an older backend sent. */
const normalize = (s: ScreenSection): ScreenSection => ({
  ...s,
  text: s.text ?? null,
  audience: { ...EVERYONE, ...(s.audience ?? {}) },
  startAt: s.startAt ?? null,
  endAt: s.endAt ?? null
});

type Draft = { sections: ScreenSection[]; title: string | null };

const fingerprint = (d: Draft) =>
  JSON.stringify([d.title?.trim() || null, d.sections.map((s) => [s.key, s.visible, s.text?.trim() || null, s.audience, s.startAt, s.endAt])]);

/** Problems that would make the save fail, per block key. */
const blockError = (s: ScreenSection) => {
  if (s.textMax && (s.text?.trim().length ?? 0) > s.textMax) return `${s.textLabel} is at most ${s.textMax} characters`;
  const aud = audienceError(s.audience);
  if (aud) return aud;
  if (s.startAt && s.endAt && s.endAt <= s.startAt) return "The end must be after the start";
  return null;
};

/** Short notes on what's set for a block, shown under its name. */
const blockNotes = (s: ScreenSection) => {
  const notes: string[] = [];
  if (s.text?.trim()) notes.push(`“${s.text.trim()}”`);
  const who = describeAudience(s.audience);
  if (who) notes.push(who);
  const now = Date.now();
  if (s.startAt && Date.parse(s.startAt) > now) notes.push(`From ${new Date(s.startAt).toLocaleString()}`);
  if (s.endAt) notes.push(Date.parse(s.endAt) <= now ? "Ended — not shown" : `Until ${new Date(s.endAt).toLocaleString()}`);
  return notes;
};

export const LayoutPage: React.FC = () => {
  const { config, banners, canManage, applySaved, reload } = useCms();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const screen: Screen = SCREENS.includes(params.get("screen") as Screen) ? (params.get("screen") as Screen) : "home";
  // One draft per screen, so switching screens doesn't lose edits.
  const [drafts, setDrafts] = useState<Partial<Record<Screen, Draft>>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [saving, setSaving] = useState(false);

  const titleInfo = screen === "home" ? undefined : config!.screenTitles?.[screen];
  const savedFor = (s: Screen): Draft | undefined => {
    const list = s === "home" ? config!.homeSections : config!.screenSections?.[s];
    if (!list) return undefined;
    return { sections: list.map(normalize), title: s === "home" ? null : config!.screenTitles?.[s]?.title ?? null };
  };
  const isDirty = (s: Screen) => {
    const d = drafts[s];
    const saved = savedFor(s);
    return Boolean(d && saved && fingerprint(d) !== fingerprint(saved));
  };

  const saved = savedFor(screen);
  const draft = drafts[screen] ?? saved;
  const dirty = isDirty(screen);
  const palette = useMemo(() => resolvePalette(mode, config!.theme), [mode, config]);
  const hubTitles = useMemo(() => ({ ...hubTitlesOf(config!), ...(screen !== "home" && draft ? { [screen]: draft.title } : {}) }), [config, screen, draft]);

  const update = (fn: (d: Draft) => Draft) => setDrafts((all) => ({ ...all, [screen]: fn(all[screen] ?? saved!) }));
  const setSections = (fn: (list: ScreenSection[]) => ScreenSection[]) => update((d) => ({ ...d, sections: fn(d.sections) }));
  const setBlock = (key: string, patch: Partial<ScreenSection>) => setSections((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const dropDrafts = (screens: Screen[]) =>
    setDrafts((all) => Object.fromEntries(Object.entries(all).filter(([s]) => !screens.includes(s as Screen))));

  /** Move the block `key` to position `to`. */
  const moveTo = (key: string, to: number) =>
    setSections((list) => {
      const from = list.findIndex((s) => s.key === key);
      if (from < 0 || to < 0 || to >= list.length || from === to) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const handleSave = async () => {
    if (!draft) return;
    const bad = draft.sections.find(blockError);
    if (bad) {
      setOpen(bad.key);
      toast("error", `${bad.label}: ${blockError(bad)}`);
      return;
    }
    if ((draft.title?.trim().length ?? 0) > TITLE_MAX) {
      toast("error", `The title is at most ${TITLE_MAX} characters.`);
      return;
    }
    setSaving(true);
    try {
      applySaved(
        screen === "home"
          ? await saveHomeSections(config!.sectionVersions.homeSections, draft.sections)
          : await saveScreenSections(config!.sectionVersions.screenSections ?? 0, screen, draft.sections, titleInfo ? draft.title : undefined)
      );
      dropDrafts([screen]);
      toast("success", `${SCREEN_LABEL[screen]} layout published.`);
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        // Someone else saved this section: start over from theirs. The
        // non-Home screens share one lock, so all their drafts go.
        dropDrafts(screen === "home" ? ["home"] : LAYOUT_SCREENS);
        await reload();
      } else toast("error", errorMessage(err, "Couldn't save the layout."));
    } finally {
      setSaving(false);
    }
  };

  const preview = () => {
    const common = { features: config!.features, links: config!.customTiles, banners, palette };
    if (screen === "home") return <HomeScreen {...common} sections={draft?.sections ?? []} mode={mode} hubTitles={hubTitles} />;
    if (screen === "profile") return <ProfileScreen {...common} sections={draft?.sections} />;
    return <HubScreen {...common} placement={screen} sections={draft?.sections} title={draft?.title} mode={mode} />;
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Screens" title="Screen layouts">
        The blocks that make up each screen: drag to reorder, switch off, or open one to rename it, target it or schedule it. Blocks with a lock hold
        something people always need: they can move and be renamed, but always show. The tiles inside a screen are in{" "}
        <Link to="/features">Features &amp; tiles</Link>.
      </PageHeader>

      <div className="layout-screens">
        <Segmented
          label="Screen"
          value={screen}
          onChange={(s) => {
            setOpen(null);
            setParams(s === "home" ? {} : { screen: s }, { replace: true });
          }}
          options={SCREENS.map((s) => ({ value: s, label: `${SCREEN_LABEL[s]}${s !== screen && isDirty(s) ? " •" : ""}` }))}
        />
      </div>

      <div className="with-preview">
        <section className="card">
          {!draft ? (
            <p className="muted">
              The backend doesn't support layouts for this screen yet. Deploy the period-buddy-be version with screen layouts, then reload.
            </p>
          ) : (
            <>
              {titleInfo && (
                <div className="layout-title">
                  <label className="field">
                    <span>Screen title</span>
                    <input
                      value={draft.title ?? ""}
                      placeholder={titleInfo.default}
                      maxLength={TITLE_MAX}
                      onChange={(e) => update((d) => ({ ...d, title: e.target.value || null }))}
                    />
                  </label>
                  <small className="muted">Also the name of this hub's card on Home. Leave empty for “{titleInfo.default}”.</small>
                </div>
              )}

              <ol className="section-list">
                {draft.sections.map((s, i) => {
                  const promo = promoPlacement(screen, s.key);
                  const tileCount = isTileBlock(screen, s.key) ? tilesIn(config!.features, config!.customTiles, screen).length : null;
                  const liveCount = promo ? liveBannersIn(banners, promo).length : 0;
                  const notes = blockNotes(s);
                  const editable = Boolean(s.textLabel) || !s.required;
                  const isOpen = open === s.key;
                  const err = blockError(s);
                  return (
                    <li
                      key={s.key}
                      className={`section-item ${s.visible ? "" : "is-hidden"} ${dragKey === s.key ? "is-dragging" : ""}`}
                      onDragOver={(e) => {
                        if (!dragKey) return;
                        e.preventDefault();
                        if (dragKey !== s.key) moveTo(dragKey, i);
                      }}
                      onDrop={(e) => e.preventDefault()}
                    >
                      <div className="section-row">
                        <span
                          className="drag-handle"
                          draggable
                          title="Drag to reorder"
                          aria-hidden
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", s.key);
                            setDragKey(s.key);
                          }}
                          onDragEnd={() => setDragKey(null)}
                        >
                          <GripVertical size={15} />
                        </span>
                        <span className="section-num">{i + 1}</span>
                        <div className="section-text">
                          <strong>
                            {promo && <Megaphone size={13} />} {s.label}
                            {err && <em className="section-flag">Fix</em>}
                          </strong>
                          <span>
                            {SECTION_HELP[screen][s.key]}
                            {promo && ` ${liveCount} live now.`}
                            {tileCount !== null && (
                              <>
                                {` ${tileCount} tile${tileCount === 1 ? "" : "s"} now. `}
                                <Link className="section-link" to={`/features?screen=${screen}`}>
                                  Edit tiles →
                                </Link>
                              </>
                            )}
                          </span>
                          {notes.length > 0 && <span className="section-notes">{notes.join(" · ")}</span>}
                        </div>
                        <div className="order-btns horizontal">
                          <button type="button" className="icon-btn sm" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => moveTo(s.key, i - 1)}>
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn sm"
                            aria-label={`Move ${s.label} down`}
                            disabled={i === draft.sections.length - 1}
                            onClick={() => moveTo(s.key, i + 1)}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                        {editable ? (
                          <button
                            type="button"
                            className={`icon-btn sm section-edit ${isOpen ? "is-open" : ""}`}
                            aria-expanded={isOpen}
                            aria-label={`Edit ${s.label}`}
                            onClick={() => setOpen(isOpen ? null : s.key)}
                          >
                            <ChevronDown size={14} />
                          </button>
                        ) : (
                          <span className="icon-btn-spacer" />
                        )}
                        {s.required ? (
                          <span className="section-lock" title="Always shown" aria-label={`${s.label} is always shown`}>
                            <Lock size={14} />
                          </span>
                        ) : (
                          <Switch checked={s.visible} label={`Show ${s.label}`} hideLabel onChange={(v) => setBlock(s.key, { visible: v })} />
                        )}
                      </div>

                      {isOpen && (
                        <div className="section-editor">
                          {s.textLabel && (
                            <label className="field">
                              <span>
                                {s.textLabel} <em className="muted">({(s.text ?? "").length}/{s.textMax})</em>
                              </span>
                              <div className="input-with-reset">
                                <input
                                  value={s.text ?? ""}
                                  placeholder={s.textDefault}
                                  maxLength={s.textMax}
                                  onChange={(e) => setBlock(s.key, { text: e.target.value || null })}
                                />
                                {s.text && (
                                  <button type="button" className="icon-btn sm" aria-label="Back to the app's text" title="Back to the app's text" onClick={() => setBlock(s.key, { text: null })}>
                                    <RotateCcw size={13} />
                                  </button>
                                )}
                              </div>
                              <small className="muted">Leave empty for the app's own text: “{s.textDefault}”.</small>
                            </label>
                          )}
                          {s.required ? (
                            <p className="muted small">Always shown to everyone, so it can't be targeted or scheduled.</p>
                          ) : (
                            <>
                              <AudienceEditor
                                value={s.audience}
                                onChange={(audience) => setBlock(s.key, { audience })}
                                legend="Who sees this block"
                                hint="Older app builds that don't understand targeting show the block to everyone."
                              />
                              <div className="field-row">
                                <label className="field">
                                  <span>Show from (optional)</span>
                                  <input type="datetime-local" value={toLocalInput(s.startAt)} onChange={(e) => setBlock(s.key, { startAt: fromLocalInput(e.target.value) })} />
                                </label>
                                <label className="field">
                                  <span>Show until (optional)</span>
                                  <input type="datetime-local" value={toLocalInput(s.endAt)} onChange={(e) => setBlock(s.key, { endAt: fromLocalInput(e.target.value) })} />
                                </label>
                              </div>
                              {err && <small className="warn">{err}</small>}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>

        <aside className="preview-col">
          <div className="preview-controls">
            <Segmented label="Preview mode" value={mode} onChange={setMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          <PhoneFrame palette={palette}>{preview()}</PhoneFrame>
          <p className="muted small">The preview shows every block that's switched on. Targeted or scheduled blocks only show to their audience, within their dates.</p>
        </aside>
      </div>

      <SaveBar dirty={dirty} saving={saving} canManage={canManage} onSave={handleSave} onDiscard={() => dropDrafts([screen])} />
    </div>
  );
};
