import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import {
  CyclePhase,
  CycleSyncTip,
  TipCategory,
  TipInput,
  TipsResponse,
  createTip,
  deleteTip,
  errorMessage,
  listTips,
  seedTips,
  updateTip
} from "../lib/api";
import { useCms } from "../lib/store";
import { ErrorState, Loading, PageHeader, Segmented, Switch, useToast } from "../components/ui";

/**
 * Tips on the app's "Your Era" screen (GET /api/genz/era): four eras, one
 * per cycle phase, each with Move / Fuel / Self-care / Vibe tips. Until the
 * first save the app shows built-in defaults; "Customise" copies them in so
 * every one can be edited, paused or removed. Changes reach the app on its
 * next open of the screen.
 */

const PHASE_LABEL: Record<CyclePhase, string> = {
  period: "Period",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal"
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

  const tipsFor = (category: TipCategory) =>
    data.tips.filter((t) => t.phase === phase && t.category === category).sort((a, b) => a.order - b.order);

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
            label: `${data.eras[p].emoji} ${PHASE_LABEL[p]} (${data.tips.filter((t) => t.phase === p && t.active).length})`
          }))}
        />
      </div>

      <div className="era-hero" style={{ background: `linear-gradient(135deg, ${era.aura[0]}, ${era.aura[1]})` }}>
        <span className="era-emoji">{era.emoji}</span>
        <div>
          <strong>{`In my ${era.name}`}</strong>
          <p>{era.tagline}</p>
        </div>
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
