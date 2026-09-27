import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Pencil, Plus, RotateCcw, Trash2, Wand2, X } from "lucide-react";
import {
  CyclePhase,
  CycleSyncTip,
  EraInput,
  PhaseEra,
  TipCategory,
  TipInput,
  TipsResponse,
  createTip,
  deleteTip,
  errorMessage,
  listTips,
  resetEra,
  seedTips,
  updateEra,
  updateTip
} from "../lib/api";
import { useCms } from "../lib/store";
import { ErrorState, Loading, PageHeader, Segmented, Switch, useToast } from "../components/ui";

/**
 * Tips on the app's "Your Era" screen (GET /api/genz/era): four eras, one
 * per cycle phase, each with Move / Fuel / Self-care / Vibe tips. Until the
 * first save the app shows built-in defaults; "Customise" copies them in so
 * every one can be edited, paused or removed. Each era's card (name, emoji,
 * tagline, colours) is edited separately with "Edit era". Changes reach the app on its
 * next open of the screen.
 */

const PHASE_LABEL: Record<CyclePhase, string> = {
  period: "Period",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal"
};

/** Quick picks in the editor; any emoji can still be typed. */
const EMOJI_PICKS: Record<TipCategory, string[]> = {
  move: ["🧘", "🚶‍♀️", "🏃‍♀️", "💃", "🏋️‍♀️", "🚴‍♀️", "🤸‍♀️", "🏊‍♀️"],
  fuel: ["🍫", "🥗", "🍵", "🥑", "🍌", "🥜", "🫐", "💧"],
  selfCare: ["🛁", "😴", "🔥", "🧴", "📓", "🕯️", "💆‍♀️", "🌿"],
  vibe: ["🎧", "🎬", "📚", "✨", "💅", "🎨", "☕", "🌙"]
};

/** The tip as the app draws it on the Your Era screen. */
const TipPreview: React.FC<{ tip: Pick<TipInput, "emoji" | "title" | "body">; aura: [string, string] }> = ({ tip, aura }) => (
  <div className="tip-preview" aria-label="Preview in the app">
    <span className="tip-preview-emoji" style={{ background: `${aura[0]}22` }}>
      {tip.emoji || "✨"}
    </span>
    <div className="tip-text">
      <strong>{tip.title || "Your tip title"}</strong>
      {tip.body && <span>{tip.body}</span>}
    </div>
    <span className="tip-preview-check" />
  </div>
);

/** Quick picks for an era card; any emoji can still be typed. */
const ERA_EMOJI_PICKS = ["🧸", "🌱", "💅", "🌙", "🌸", "✨", "🔥", "🦋", "☁️", "🍓", "👑", "🫶"];

/** Two-stop gradients that read well behind white text. */
const AURA_PRESETS: [string, string][] = [
  ["#FF6B8B", "#FFB3C1"],
  ["#34C99A", "#A8F0D4"],
  ["#FFB547", "#FF7A7A"],
  ["#8E7CFF", "#C9B8FF"],
  ["#E8618F", "#B9A6E0"],
  ["#3A86FF", "#9CC5FF"],
  ["#F28C6B", "#FFD1A8"],
  ["#2E9C7E", "#7FD3B8"]
];

const HEX6 = /^#[0-9a-f]{6}$/i;

/** The era card as the app draws it at the top of the Your Era screen. */
const EraPreview: React.FC<{ era: EraInput; phase: CyclePhase }> = ({ era, phase }) => {
  const [a, b] = era.aura.map((c) => (HEX6.test(c) ? c : "#999999"));
  return (
    <div className="era-preview" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} aria-label="Preview in the app">
      <div className="era-preview-top">
        <span className="era-preview-emoji">{era.emoji || "✨"}</span>
        <div>
          <small>{`Day 3 · ${PHASE_LABEL[phase]} phase`}</small>
          <strong>{era.name || "Era name"}</strong>
        </div>
      </div>
      <p>{era.tagline || "A short line about this phase."}</p>
      <div className="era-preview-stats">
        <span>
          <b>4 days</b>left in this era
        </span>
        <i />
        <span>
          <b>Next era</b>up next
        </span>
      </div>
    </div>
  );
};

const EraEditor: React.FC<{
  phase: CyclePhase;
  era: PhaseEra;
  defaults: PhaseEra;
  customised: boolean;
  onClose: () => void;
  onSaved: (eras: Record<CyclePhase, PhaseEra>, customised: boolean) => void;
}> = ({ phase, era, defaults, customised, onClose, onSaved }) => {
  const toast = useToast();
  const [draft, setDraft] = useState<EraInput>({ name: era.name, emoji: era.emoji, tagline: era.tagline, aura: [era.aura[0], era.aura[1]] });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<EraInput>) => setDraft((d) => ({ ...d, ...patch }));
  const setColor = (i: 0 | 1, c: string) => set({ aura: (i === 0 ? [c, draft.aura[1]] : [draft.aura[0], c]) as [string, string] });

  const blocker = !draft.name.trim()
    ? "Give the era a name"
    : !draft.emoji.trim()
      ? "Pick an emoji"
      : !draft.tagline.trim()
        ? "Add a tagline"
        : !draft.aura.every((c) => HEX6.test(c.trim()))
          ? "Colours look like #FF6B8B"
          : null;

  const save = async () => {
    setSaving(true);
    try {
      const { eras } = await updateEra(phase, {
        name: draft.name.trim(),
        emoji: draft.emoji.trim(),
        tagline: draft.tagline.trim(),
        aura: [draft.aura[0].trim(), draft.aura[1].trim()]
      });
      onSaved(eras, true);
      toast("success", "Era saved. It shows in the app next time the screen opens.");
      onClose();
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't save the era."));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Go back to the built-in “${defaults.name}” card for the ${PHASE_LABEL[phase].toLowerCase()} phase?`)) return;
    setSaving(true);
    try {
      const { eras } = await resetEra(phase);
      onSaved(eras, false);
      toast("success", "Era reset to the default.");
      onClose();
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't reset the era."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={() => !saving && onClose()}>
      <section className="drawer drawer-narrow" role="dialog" aria-modal="true" aria-labelledby="era-editor-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2 id="era-editor-title">{`Edit the ${PHASE_LABEL[phase].toLowerCase()} era`}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-form">
            <EraPreview era={draft} phase={phase} />
            <div className="field-row">
              <label className="field" style={{ maxWidth: 120 }}>
                <span>Emoji *</span>
                <input value={draft.emoji} maxLength={16} onChange={(e) => set({ emoji: e.target.value })} />
              </label>
              <label className="field">
                <span>Name *</span>
                <input value={draft.name} maxLength={30} placeholder="e.g. Cozy Girl Era" onChange={(e) => set({ name: e.target.value })} />
              </label>
            </div>
            <div className="emoji-picks" role="group" aria-label="Suggested emoji">
              {ERA_EMOJI_PICKS.map((e) => (
                <button key={e} type="button" className={`emoji-pick${draft.emoji === e ? " is-active" : ""}`} onClick={() => set({ emoji: e })} aria-label={`Use ${e}`}>
                  {e}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Tagline *</span>
              <textarea value={draft.tagline} maxLength={120} rows={2} placeholder="One short, kind line about this phase." onChange={(e) => set({ tagline: e.target.value })} />
              <small className="muted">{`${draft.tagline.length}/120`}</small>
            </label>
            <div className="field">
              <span>Card colours</span>
              <div className="aura-presets" role="group" aria-label="Colour presets">
                {AURA_PRESETS.map(([a, b]) => {
                  const active = draft.aura[0].toUpperCase() === a && draft.aura[1].toUpperCase() === b;
                  return (
                    <button
                      key={a + b}
                      type="button"
                      className={`aura-preset${active ? " is-active" : ""}`}
                      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                      onClick={() => set({ aura: [a, b] })}
                      aria-label={`Use ${a} to ${b}`}
                      aria-pressed={active}
                    />
                  );
                })}
              </div>
              <div className="field-row">
                {([0, 1] as const).map((i) => (
                  <label key={i} className="field aura-color">
                    <span>{i === 0 ? "Start" : "End"}</span>
                    <span className="aura-color-input">
                      <input type="color" value={HEX6.test(draft.aura[i]) ? draft.aura[i] : "#999999"} onChange={(e) => setColor(i, e.target.value.toUpperCase())} aria-label={`${i === 0 ? "Start" : "End"} colour`} />
                      <input value={draft.aura[i]} maxLength={7} onChange={(e) => setColor(i, e.target.value)} />
                    </span>
                  </label>
                ))}
              </div>
              <small className="muted">Keep them bright enough for white text. The first colour also tints the tip icons.</small>
            </div>
          </div>
        </div>
        <footer className="drawer-foot">
          <span className="era-editor-foot-left">
            {customised && (
              <button type="button" className="btn btn-ghost" onClick={reset} disabled={saving}>
                <RotateCcw size={14} /> Reset to default
              </button>
            )}
            {(blocker || !customised) && <span className="muted small">{blocker ?? "Goes live as soon as you save."}</span>}
          </span>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || Boolean(blocker)}>
              {saving && <Loader2 size={15} className="spin" />} Save era
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

const TipEditor: React.FC<{
  initial: CycleSyncTip | null;
  phase: CyclePhase;
  category: TipCategory;
  data: TipsResponse;
  onClose: () => void;
  onSaved: (tip: CycleSyncTip) => void;
}> = ({ initial, phase, category, data, onClose, onSaved }) => {
  const toast = useToast();
  const [draft, setDraft] = useState<TipInput>(
    initial
      ? { phase: initial.phase, category: initial.category, emoji: initial.emoji, title: initial.title, body: initial.body, active: initial.active, order: initial.order }
      : {
          phase,
          category,
          emoji: "",
          title: "",
          body: "",
          active: true,
          order: Math.max(0, ...data.tips.filter((t) => t.phase === phase && t.category === category).map((t) => t.order + 1))
        }
  );
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<TipInput>) => setDraft((d) => ({ ...d, ...patch }));
  const blocker = !draft.title.trim() ? "Add a title" : draft.emoji.length > 16 ? "Use a single emoji" : null;

  const save = async () => {
    setSaving(true);
    try {
      const input = { ...draft, title: draft.title.trim(), body: draft.body.trim(), emoji: draft.emoji.trim() };
      const { tip } = initial?._id ? await updateTip(initial._id, input) : await createTip(input);
      onSaved(tip);
      toast("success", initial ? "Tip saved." : "Tip added. It's live in the app.");
      onClose();
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't save the tip."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={() => !saving && onClose()}>
      <section className="drawer drawer-narrow" role="dialog" aria-modal="true" aria-labelledby="tip-editor-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2 id="tip-editor-title">{initial ? "Edit tip" : "New tip"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-form">
            <div className="field-row">
              <label className="field">
                <span>Era</span>
                <select value={draft.phase} onChange={(e) => set({ phase: e.target.value as CyclePhase })}>
                  {data.phases.map((p) => (
                    <option key={p} value={p}>
                      {`${data.eras[p].emoji} ${data.eras[p].name} (${PHASE_LABEL[p]})`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Section</span>
                <select value={draft.category} onChange={(e) => set({ category: e.target.value as TipCategory })}>
                  {data.categories.map((c) => (
                    <option key={c} value={c}>
                      {data.categoryLabels[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field" style={{ maxWidth: 120 }}>
                <span>Emoji</span>
                <input value={draft.emoji} maxLength={16} placeholder="🍫" onChange={(e) => set({ emoji: e.target.value })} />
              </label>
              <label className="field">
                <span>Title *</span>
                <input value={draft.title} maxLength={60} placeholder="e.g. Dark chocolate, guilt-free" onChange={(e) => set({ title: e.target.value })} autoFocus />
              </label>
            </div>
            <div className="emoji-picks" role="group" aria-label="Suggested emoji">
              {EMOJI_PICKS[draft.category].map((e) => (
                <button key={e} type="button" className={`emoji-pick${draft.emoji === e ? " is-active" : ""}`} onClick={() => set({ emoji: e })} aria-label={`Use ${e}`}>
                  {e}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Tip</span>
              <textarea value={draft.body} maxLength={200} rows={3} placeholder="One or two short lines. Friendly, not medical advice." onChange={(e) => set({ body: e.target.value })} />
              <small className="muted">{`${draft.body.length}/200`}</small>
            </label>
            <div className="field-row">
              <label className="field">
                <span>Order (lower shows first)</span>
                <input type="number" min={0} value={draft.order} onChange={(e) => set({ order: Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
              </label>
              <div className="field switches">
                <Switch checked={draft.active} onChange={(active) => set({ active })} label="Shown in the app" />
              </div>
            </div>
            <div className="field">
              <span>{`Preview · ${data.eras[draft.phase].name}`}</span>
              <TipPreview tip={draft} aura={data.eras[draft.phase].aura} />
            </div>
          </div>
        </div>
        <footer className="drawer-foot">
          <span className="muted small">{blocker ?? "Goes live as soon as you save."}</span>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || Boolean(blocker)}>
              {saving && <Loader2 size={15} className="spin" />} {initial ? "Save tip" : "Add tip"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export const CycleSyncPage: React.FC = () => {
  const { canManage } = useCms();
  const toast = useToast();
  const [data, setData] = useState<TipsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<CyclePhase>("period");
  const [editing, setEditing] = useState<{ tip: CycleSyncTip | null; category: TipCategory } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [eraOpen, setEraOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await listTips());
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the tips."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState text={error} onRetry={load} />;
  if (!data) return <Loading text="Loading tips…" />;

  const editable = canManage && !data.usingDefaults;
  const era = data.eras[phase];
  // Older backends don't send these yet.
  const customisedEras = data.customisedEras ?? [];
  const eraDefaults = data.eraDefaults ?? data.eras;

  const upsert = (tip: CycleSyncTip) =>
    setData((d) => (d ? { ...d, tips: d.tips.some((t) => t._id === tip._id) ? d.tips.map((t) => (t._id === tip._id ? tip : t)) : [...d.tips, tip] } : d));

  const customise = async () => {
    setSeeding(true);
    try {
      await seedTips();
      await load();
      toast("success", "Defaults copied. Every tip is editable now.");
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't copy the defaults."));
    } finally {
      setSeeding(false);
    }
  };

  const toggle = async (tip: CycleSyncTip) => {
    if (!tip._id) return;
    try {
      const { tip: saved } = await updateTip(tip._id, { ...tip, active: !tip.active });
      upsert(saved);
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't update the tip."));
    }
  };

  const remove = async (tip: CycleSyncTip) => {
    if (!tip._id) return;
    const last = data.tips.length === 1;
    const msg = last
      ? `Delete “${tip.title}”? It's the last saved tip, so the app goes back to the built-in defaults.`
      : `Delete “${tip.title}”? It disappears from the app right away.`;
    if (!window.confirm(msg)) return;
    try {
      await deleteTip(tip._id);
      if (last) await load();
      else setData((d) => (d ? { ...d, tips: d.tips.filter((t) => t._id !== tip._id) } : d));
      toast("success", "Tip deleted.");
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't delete the tip."));
    }
  };

  const tipsFor = (category: TipCategory, p: CyclePhase = phase) =>
    data.tips.filter((t) => t.phase === p && t.category === category).sort((a, b) => a.order - b.order);

  // Sections where the app has nothing to show (no tips, or all paused).
  const gaps = data.phases.flatMap((p) => data.categories.filter((c) => !tipsFor(c, p).some((t) => t.active)).map((c) => ({ phase: p, category: c })));
  const phaseHasGap = (p: CyclePhase) => gaps.some((g) => g.phase === p);

  /** Swap a tip with its neighbour, renumbering the section 0..n so ties can't stick. */
  const move = async (category: TipCategory, index: number, dir: -1 | 1) => {
    const list = tipsFor(category);
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const changed = reordered.map((t, order) => ({ ...t, order })).filter((t, i) => t._id && t.order !== reordered[i].order);
    if (!changed.length) return;
    setReordering(true);
    changed.forEach(upsert);
    try {
      (await Promise.all(changed.map((t) => updateTip(t._id!, t)))).forEach(({ tip }) => upsert(tip));
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't reorder the tips."));
      await load();
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Gen Z pack" title="Your Era tips">
        The app's “Your Era” screen turns each cycle phase into an era and shows cycle-syncing tips for it. Edit what each era suggests to move, eat, do and vibe to.
      </PageHeader>

      {data.usingDefaults && (
        <div className="card notice-card">
          <div>
            <strong>The app is showing the built-in tips.</strong>
            <p className="muted small">Copy them in to edit, pause or remove any of them, or to add your own.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={customise} disabled={seeding}>
              {seeding ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />} Customise tips
            </button>
          )}
        </div>
      )}

      <div className="toolbar">
        <Segmented<CyclePhase>
          label="Era"
          value={phase}
          onChange={setPhase}
          options={data.phases.map((p) => ({
            value: p,
            label: `${data.eras[p].emoji} ${PHASE_LABEL[p]} (${data.tips.filter((t) => t.phase === p && t.active).length})${phaseHasGap(p) ? " ⚠" : ""}`
          }))}
        />
      </div>

      {gaps.length > 0 && (
        <div className="notice notice-warn tip-gaps" role="status">
          <AlertTriangle size={15} />
          <span>
            {`Nothing shows in ${gaps.length === 1 ? "this section" : `these ${gaps.length} sections`}, so the app shows an empty note: `}
            {gaps.map((g) => `${PHASE_LABEL[g.phase]} · ${data.categoryLabels[g.category]}`).join(", ")}
          </span>
        </div>
      )}

      <div className="era-hero" style={{ background: `linear-gradient(135deg, ${era.aura[0]}, ${era.aura[1]})` }}>
        <span className="era-emoji">{era.emoji}</span>
        <div className="era-hero-text">
          <strong>{era.name}</strong>
          <p>{era.tagline}</p>
          {customisedEras.includes(phase) && <span className="era-hero-tag">Edited</span>}
        </div>
        {canManage && (
          <button type="button" className="era-hero-edit" onClick={() => setEraOpen(true)}>
            <Pencil size={14} /> Edit era
          </button>
        )}
      </div>

      <div className="tip-columns">
        {data.categories.map((category) => {
          const tips = tipsFor(category);
          return (
            <section key={category} className="card tip-section">
              <div className="card-title-row">
                <h2 className="card-title">{data.categoryLabels[category]}</h2>
                {editable && (
                  <button type="button" className="link-btn" onClick={() => setEditing({ tip: null, category })}>
                    <Plus size={13} /> Add
                  </button>
                )}
              </div>
              {tips.length > 0 && !tips.some((t) => t.active) && (
                <p className="warn small">Every tip here is paused, so the app shows an empty note for this tab.</p>
              )}
              {tips.length === 0 ? (
                <p className="muted small">No tips here. The app shows a friendly empty note for this tab.</p>
              ) : (
                <ul className="tip-list">
                  {tips.map((t, i) => (
                    <li key={t._id ?? `${t.title}-${i}`} className={t.active ? "" : "is-paused"}>
                      <span className="tip-emoji">{t.emoji || "✨"}</span>
                      <div className="tip-text">
                        <strong>{t.title}</strong>
                        {t.body && <span className="muted small">{t.body}</span>}
                      </div>
                      {editable && (
                        <div className="tip-actions">
                          <span className="tip-move">
                            <button type="button" className="icon-btn" onClick={() => move(category, i, -1)} disabled={reordering || i === 0} aria-label={`Move ${t.title} up`}>
                              <ArrowUp size={13} />
                            </button>
                            <button type="button" className="icon-btn" onClick={() => move(category, i, 1)} disabled={reordering || i === tips.length - 1} aria-label={`Move ${t.title} down`}>
                              <ArrowDown size={13} />
                            </button>
                          </span>
                          <Switch checked={t.active} onChange={() => toggle(t)} label="Shown" hideLabel />
                          <button type="button" className="icon-btn" onClick={() => setEditing({ tip: t, category })} aria-label={`Edit ${t.title}`}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="icon-btn danger" onClick={() => remove(t)} aria-label={`Delete ${t.title}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {eraOpen && (
        <EraEditor
          key={phase}
          phase={phase}
          era={era}
          defaults={eraDefaults[phase]}
          customised={customisedEras.includes(phase)}
          onClose={() => setEraOpen(false)}
          onSaved={(eras, customised) =>
            setData((d) =>
              d
                ? {
                    ...d,
                    eras,
                    customisedEras: customised
                      ? [...new Set([...(d.customisedEras ?? []), phase])]
                      : (d.customisedEras ?? []).filter((p) => p !== phase)
                  }
                : d
            )
          }
        />
      )}

      {editing && (
        <TipEditor
          initial={editing.tip}
          phase={phase}
          category={editing.category}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={upsert}
        />
      )}
    </div>
  );
};
