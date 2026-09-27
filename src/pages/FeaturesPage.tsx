import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Bell, ChevronDown, ChevronUp, ExternalLink, EyeOff, GripVertical, Link2, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { CustomTile, DEFAULT_LAUNCH, EVERYONE, Feature, FeaturePlacement, Launch, LaunchStats, errorMessage, saveFeatures } from "../lib/api";
import { launchConfirm, launchError, launchPill } from "../lib/launch";
import { COLOR_LABEL, PLACEMENT_HINT, PLACEMENT_LABEL, resolvePalette } from "../lib/catalog";
import { isConflict, useCms } from "../lib/store";
import { PhoneFrame, ScreenFor, ViewAs } from "../components/AppPreview";
import { LaunchEditor } from "../components/LaunchEditor";
import { ActionEditor, AudienceEditor, IconPicker, actionError, audienceError, describeAction, describeAudience } from "../components/editors";
import { PageHeader, SaveBar, Segmented, Switch, useToast } from "../components/ui";

const PLACEMENTS: FeaturePlacement[] = ["home", "care_hub", "wellness_hub", "explore_hub", "profile"];

// Link tiles get a client-side id until the server assigns one on save.
type Link = CustomTile & { localId: string };
let nextLocal = 1;
const withLocalIds = (tiles: CustomTile[]): Link[] => tiles.map((t) => ({ ...t, localId: t.id ?? `new${nextLocal++}` }));

/** One row in a column: a built-in feature or a link tile. */
type Item = { id: string; order: number; kind: "feature"; feature: Feature } | { id: string; order: number; kind: "link"; link: Link };

const itemsIn = (features: Feature[], links: Link[], p: FeaturePlacement): Item[] =>
  [
    ...features.filter((f) => f.placement === p).map((f) => ({ id: f.key, order: f.order, kind: "feature" as const, feature: f })),
    ...links.filter((l) => l.placement === p).map((l) => ({ id: `link:${l.localId}`, order: l.order, kind: "link" as const, link: l }))
  ].sort((a, b) => a.order - b.order);

/** Re-number `order` 0..n in each column across features and links, keeping the sequence. */
const normalize = (features: Feature[], links: Link[]) => {
  const orderOf = new Map<string, number>();
  for (const p of PLACEMENTS) itemsIn(features, links, p).forEach((it, i) => orderOf.set(it.id, i));
  return {
    features: features.map((f) => ({ ...f, order: orderOf.get(f.key) ?? f.order })),
    links: links.map((l) => ({ ...l, order: orderOf.get(`link:${l.localId}`) ?? l.order }))
  };
};

const snapshot = (features: Feature[], links: Link[]) => {
  const n = normalize(features, links);
  return JSON.stringify([n.features, n.links.map(({ localId: _l, ...t }) => t)]);
};

export const FeaturesPage: React.FC = () => {
  const { config, canManage, applySaved, reload, banners, launchStats } = useCms();
  const toast = useToast();
  const [params] = useSearchParams();
  const initial = useMemo(() => normalize(config!.features, withLocalIds(config!.customTiles)), [config]);
  const [features, setFeatures] = useState<Feature[]>(initial.features);
  const [links, setLinks] = useState<Link[]>(initial.links);
  // ?open=<row id> (from the Launches page) opens that row's editor on its screen.
  const [open, setOpen] = useState<string | null>(() => params.get("open"));
  const [preview, setPreview] = useState<FeaturePlacement>(() => {
    const id = params.get("open");
    return (
      initial.features.find((f) => f.key === id)?.placement ??
      initial.links.find((l) => `link:${l.localId}` === id)?.placement ??
      "home"
    );
  });
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [viewAs, setViewAs] = useState<ViewAs>("others");
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Arriving from the Launches page: bring the opened row into view.
  useEffect(() => {
    const id = params.get("open");
    if (id) document.getElementById(`row-${id}`)?.scrollIntoView({ block: "center" });
  }, []);

  // A reload (e.g. after a conflict) replaces the draft with the saved state.
  useEffect(() => {
    setFeatures(initial.features);
    setLinks(initial.links);
  }, [initial]);

  const catalog = config!.catalog;
  const palette = useMemo(() => resolvePalette(mode, config!.theme), [mode, config]);
  const dirty = snapshot(features, links) !== snapshot(initial.features, initial.links);

  const updateFeature = (key: string, patch: Partial<Feature>) => setFeatures((d) => d.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const updateLink = (localId: string, patch: Partial<Link>) => setLinks((d) => d.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));

  /** Move an item to `placement`, before `beforeId` (or to the end). */
  const moveTo = (id: string, placement: FeaturePlacement, beforeId: string | null = null) => {
    if (id === beforeId) return;
    const target = itemsIn(features, links, placement).filter((it) => it.id !== id);
    const idx = beforeId ? target.findIndex((it) => it.id === beforeId) : target.length;
    const ids = target.map((it) => it.id);
    ids.splice(idx < 0 ? ids.length : idx, 0, id);
    const orderOf = new Map(ids.map((x, i) => [x, i]));
    const place = (itemId: string) => (orderOf.has(itemId) ? { placement, order: orderOf.get(itemId)! } : null);
    const f2 = features.map((f) => {
      const p = place(f.key);
      return p ? { ...f, ...p } : f;
    });
    const l2 = links.map((l) => {
      const p = place(`link:${l.localId}`);
      return p ? { ...l, ...p } : l;
    });
    const n = normalize(f2, l2);
    setFeatures(n.features);
    setLinks(n.links);
    setPreview(placement);
  };

  const nudge = (item: Item, placement: FeaturePlacement, dir: -1 | 1) => {
    const list = itemsIn(features, links, placement);
    const i = list.findIndex((it) => it.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    // Moving down = insert before the item after next.
    moveTo(item.id, placement, dir === -1 ? list[j].id : list[j + 1]?.id ?? null);
  };

  const addLink = (placement: FeaturePlacement) => {
    if (links.length >= catalog.maxCustomTiles) return toast("error", `You can have at most ${catalog.maxCustomTiles} link tiles.`);
    const localId = `new${nextLocal++}`;
    const order = itemsIn(features, links, placement).length;
    setLinks((d) => [
      ...d,
      {
        localId,
        title: "",
        description: "",
        icon: "link-outline",
        colorKey: "primary",
        placement,
        size: "small",
        order,
        enabled: true,
        badge: null,
        action: { type: "url", value: "https://", fallbackUrl: null },
        audience: EVERYONE,
        launch: DEFAULT_LAUNCH
      }
    ]);
    setOpen(`link:${localId}`);
    setPreview(placement);
  };

  const removeLink = (l: Link) => {
    if (!window.confirm(`Remove the link tile “${l.title || "Untitled"}”?`)) return;
    setLinks((d) => d.filter((x) => x.localId !== l.localId));
  };

  const resetFeature = (f: Feature) =>
    updateFeature(f.key, {
      title: f.defaults.title,
      description: f.defaults.description,
      size: f.defaults.size,
      colorKey: f.defaults.colorKey,
      badge: null,
      enabled: true,
      audience: EVERYONE
    });

  const savedLaunchOf = (id: string): Launch | undefined =>
    id.startsWith("link:")
      ? initial.links.find((l) => `link:${l.localId}` === id)?.launch
      : initial.features.find((f) => f.key === id)?.launch;

  const problem = (() => {
    for (const l of links) {
      if (!l.title.trim()) return "Every link tile needs a title";
      const e = actionError(l.action) ?? audienceError(l.audience) ?? launchError(l.launch, savedLaunchOf(`link:${l.localId}`));
      if (e) return `${l.title}: ${e}`;
    }
    for (const f of features) {
      const e = audienceError(f.audience) ?? launchError(f.launch, savedLaunchOf(f.key));
      if (e) return `${f.title}: ${e}`;
    }
    return null;
  })();

  const handleSave = async () => {
    if (problem) return toast("error", problem);
    // Launching to everyone, or taking a feature away from people, is confirmed first.
    const confirms = [
      ...features.map((f) => { const s = savedLaunchOf(f.key); return s ? launchConfirm(f.title, s, f.launch) : null; }),
      ...links.map((l) => { const s = savedLaunchOf(`link:${l.localId}`); return s ? launchConfirm(l.title, s, l.launch) : null; })
    ].filter(Boolean);
    if (confirms.length && !window.confirm(`${confirms.join("\n\n")}\n\nPublish now?`)) return;
    setSaving(true);
    try {
      const n = normalize(features, links);
      const saved = await saveFeatures(
        config!.sectionVersions.features,
        n.features,
        n.links.map(({ localId: _l, ...t }) => ({ ...t, title: t.title.trim(), description: t.description?.trim() || null, badge: t.badge?.trim() || null }))
      );
      applySaved(saved);
      toast("success", "Published. The app picks it up on its next refresh.");
    } catch (err) {
      if (isConflict(err)) {
        toast("error", errorMessage(err));
        await reload();
      } else toast("error", errorMessage(err, "Couldn't publish."));
    } finally {
      setSaving(false);
    }
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDropAt = (placement: FeaturePlacement, beforeId: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropTarget(null);
    if (id) moveTo(id, placement, beforeId);
  };
  const allowDrop = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dropTarget !== key) setDropTarget(key);
  };

  const hiddenCount = features.filter((f) => !f.enabled).length + links.filter((l) => !l.enabled).length;

  return (
    <div className="page">
      <PageHeader eyebrow="Show what, where & to whom" title="Screens & features">
        Drag features and your own link tiles between Home, Profile and the three hubs, reorder them, restyle them and
        choose who sees them. Link tiles can open a website, another app, or any screen in the app.
        {hiddenCount > 0 && ` ${hiddenCount} hidden right now.`}
      </PageHeader>

      <div className="with-preview">
        <div className="hub-columns">
          {PLACEMENTS.map((p) => {
            const items = itemsIn(features, links, p);
            const visible = items.filter((it) => (it.kind === "feature" ? it.feature.enabled : it.link.enabled)).length;
            return (
              <section
                key={p}
                className={`card hub-card ${dropTarget === `col:${p}` ? "is-drop" : ""}`}
                onMouseEnter={() => setPreview(p)}
                onDragOver={allowDrop(`col:${p}`)}
                onDragLeave={() => setDropTarget((t) => (t === `col:${p}` ? null : t))}
                onDrop={onDropAt(p, null)}
              >
                <header className="hub-card-head">
                  <div>
                    <h2>{PLACEMENT_LABEL[p]}</h2>
                    <span className="muted small">{PLACEMENT_HINT[p]}</span>
                  </div>
                  <span className="muted small">{visible} shown</span>
                </header>
                {items.length === 0 && <p className="drop-empty">Drag a feature here, or add a link.</p>}
                <ul className="feature-list">
                  {items.map((it, i) => {
                    const isOpen = open === it.id;
                    const enabled = it.kind === "feature" ? it.feature.enabled : it.link.enabled;
                    const title = it.kind === "feature" ? it.feature.title : it.link.title || "Untitled link";
                    const size = it.kind === "feature" ? it.feature.size : it.link.size;
                    const colorKey = it.kind === "feature" ? it.feature.colorKey : it.link.colorKey;
                    const badge = it.kind === "feature" ? it.feature.badge : it.link.badge;
                    const audience = it.kind === "feature" ? it.feature.audience : it.link.audience;
                    const launch = it.kind === "feature" ? it.feature.launch : it.link.launch;
                    const pill = launchPill(launch);
                    const stats = launchStats[it.kind === "feature" ? it.feature.key : `link:${it.link.id}`];
                    const who = describeAudience(audience);
                    return (
                      <li
                        key={it.id}
                        id={`row-${it.id}`}
                        className={`feature-row ${enabled ? "" : "is-hidden"} ${isOpen ? "is-open" : ""} ${dragId === it.id ? "is-dragging" : ""} ${dropTarget === it.id ? "is-drop-before" : ""}`}
                        onDragOver={allowDrop(it.id)}
                        onDrop={onDropAt(p, it.id)}
                      >
                        <div className="feature-main">
                          <span className="drag-handle" draggable onDragStart={onDragStart(it.id)} onDragEnd={() => { setDragId(null); setDropTarget(null); }} title="Drag to move" aria-hidden>
                            <GripVertical size={15} />
                          </span>
                          <div className="order-btns">
                            <button type="button" className="icon-btn sm" aria-label={`Move ${title} up`} disabled={i === 0} onClick={() => nudge(it, p, -1)}>
                              <ArrowUp size={13} />
                            </button>
                            <button type="button" className="icon-btn sm" aria-label={`Move ${title} down`} disabled={i === items.length - 1} onClick={() => nudge(it, p, 1)}>
                              <ArrowDown size={13} />
                            </button>
                          </div>
                          <button type="button" className="feature-name" onClick={() => setOpen(isOpen ? null : it.id)} aria-expanded={isOpen}>
                            <strong>
                              {it.kind === "link" && <Link2 size={12} className="kind-icon" />}
                              {title}
                              {badge && <em className="badge">{badge}</em>}
                              {pill && <em className={`pill launch-pill ${pill.cls}`}>{pill.text}</em>}
                            </strong>
                            <span>
                              {enabled ? (
                                `${size === "large" ? "Large row" : "Grid tile"} · ${COLOR_LABEL[colorKey] ?? colorKey}`
                              ) : (
                                <>
                                  <EyeOff size={11} /> Hidden
                                </>
                              )}
                              {it.kind === "link" && (
                                <>
                                  {" · "}
                                  {it.link.action.type === "route" ? "In-app" : <><ExternalLink size={10} /> {it.link.action.type === "app" ? "Other app" : "Website"}</>}
                                </>
                              )}
                              {who && (
                                <>
                                  {" · "}
                                  <Users size={10} /> {who}
                                </>
                              )}
                              {launch.state !== "live" && stats?.waiting ? (
                                <>
                                  {" · "}
                                  <Bell size={10} /> {stats.waiting.toLocaleString()} waiting
                                </>
                              ) : null}
                            </span>
                          </button>
                          <Switch
                            checked={enabled}
                            onChange={(v) => (it.kind === "feature" ? updateFeature(it.feature.key, { enabled: v }) : updateLink(it.link.localId, { enabled: v }))}
                            label={`Show ${title}`}
                            hideLabel
                          />
                          <button type="button" className="icon-btn sm" aria-label={isOpen ? "Close" : `Edit ${title}`} onClick={() => setOpen(isOpen ? null : it.id)}>
                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>

                        {isOpen && it.kind === "feature" && (
                          <FeatureEditor
                            feature={it.feature}
                            savedLaunch={savedLaunchOf(it.id)}
                            stats={launchStats[it.feature.key]}
                            colorKeys={catalog.tileColorKeys}
                            onChange={(patch) => updateFeature(it.feature.key, patch)}
                            onMove={(to) => moveTo(it.id, to)}
                            onReset={() => resetFeature(it.feature)}
                          />
                        )}
                        {isOpen && it.kind === "link" && (
                          <LinkEditor
                            link={it.link}
                            savedLaunch={savedLaunchOf(it.id)}
                            stats={it.link.id ? launchStats[`link:${it.link.id}`] : undefined}
                            colorKeys={catalog.tileColorKeys}
                            icons={catalog.tileIcons}
                            actions={catalog.tileActions}
                            onChange={(patch) => updateLink(it.link.localId, patch)}
                            onMove={(to) => moveTo(it.id, to)}
                            onRemove={() => removeLink(it.link)}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {canManage && (
                  <button type="button" className="add-link" onClick={() => addLink(p)}>
                    <Plus size={14} /> Add a link tile
                  </button>
                )}
              </section>
            );
          })}
        </div>

        <aside className="preview-col">
          <div className="preview-controls">
            <select value={preview} onChange={(e) => setPreview(e.target.value as FeaturePlacement)} aria-label="Screen to preview">
              {PLACEMENTS.map((p) => (
                <option key={p} value={p}>
                  {PLACEMENT_LABEL[p]}
                </option>
              ))}
            </select>
            <Segmented label="Preview mode" value={mode} onChange={setMode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </div>
          <div className="preview-controls">
            <span className="muted small">Preview as</span>
            <Segmented
              label="Preview as"
              value={viewAs}
              onChange={setViewAs}
              options={[
                { value: "others", label: "Everyone else" },
                { value: "access", label: "Has access" }
              ]}
            />
          </div>
          <PhoneFrame palette={palette}>
            <ScreenFor placement={preview} features={features} links={links} banners={banners} palette={palette} sections={config!.homeSections} mode={mode} viewAs={viewAs} />
          </PhoneFrame>
          <p className="muted small center">
            {viewAs === "others"
              ? "Your unsaved changes, as most people see them. Tap a locked tile to see its sheet."
              : "Your unsaved changes, as testers and people in a rollout see them."}
          </p>
        </aside>
      </div>

      <SaveBar dirty={dirty} saving={saving} canManage={canManage} onSave={handleSave} onDiscard={() => { setFeatures(initial.features); setLinks(initial.links); }} note={problem ?? undefined} />
    </div>
  );
};

/* --------------------------------- Editors -------------------------------- */

const MoveSelect: React.FC<{ value: FeaturePlacement; onMove: (p: FeaturePlacement) => void }> = ({ value, onMove }) => (
  <label className="field">
    <span>Screen</span>
    <select value={value} onChange={(e) => onMove(e.target.value as FeaturePlacement)}>
      {PLACEMENTS.map((x) => (
        <option key={x} value={x}>
          {PLACEMENT_LABEL[x]}
        </option>
      ))}
    </select>
  </label>
);

const StyleFields: React.FC<{
  size: Feature["size"];
  colorKey: string;
  badge: string | null;
  colorKeys: string[];
  onChange: (patch: { size?: Feature["size"]; colorKey?: string; badge?: string | null }) => void;
}> = ({ size, colorKey, badge, colorKeys, onChange }) => (
  <>
    <div className="field-row">
      <div className="field">
        <span>Shown as</span>
        <Segmented label="Tile size" value={size} onChange={(v) => onChange({ size: v })} options={[{ value: "small", label: "Grid tile" }, { value: "large", label: "Large row" }]} />
      </div>
      <label className="field">
        <span>Colour</span>
        <select value={colorKey} onChange={(e) => onChange({ colorKey: e.target.value })}>
          {colorKeys.map((c) => (
            <option key={c} value={c}>
              {COLOR_LABEL[c] ?? c}
            </option>
          ))}
        </select>
      </label>
    </div>
    <label className="field">
      <span>Badge (optional)</span>
      <input value={badge ?? ""} maxLength={12} placeholder="e.g. NEW, SALE, 20% OFF" onChange={(e) => onChange({ badge: e.target.value || null })} />
    </label>
  </>
);

type LaunchProps = { savedLaunch?: Launch; stats?: LaunchStats[string] };

const FeatureEditor: React.FC<
  {
    feature: Feature;
    colorKeys: string[];
    onChange: (patch: Partial<Feature>) => void;
    onMove: (p: FeaturePlacement) => void;
    onReset: () => void;
  } & LaunchProps
> = ({ feature: f, colorKeys, onChange, onMove, onReset, savedLaunch, stats }) => (
  <div className="feature-edit">
    <div className="field-row">
      <label className="field">
        <span>Title</span>
        <input value={f.title} maxLength={40} placeholder={f.defaults.title} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <MoveSelect value={f.placement} onMove={onMove} />
    </div>
    <label className="field">
      <span>Description</span>
      <input value={f.description} maxLength={80} placeholder={f.defaults.description} onChange={(e) => onChange({ description: e.target.value })} />
    </label>
    <StyleFields size={f.size} colorKey={f.colorKey} badge={f.badge} colorKeys={colorKeys} onChange={onChange} />
    <LaunchEditor value={f.launch} saved={savedLaunch} stats={stats} description={f.description} onChange={(launch) => onChange({ launch })} />
    <AudienceEditor value={f.audience} onChange={(audience) => onChange({ audience })} />
    <div className="feature-edit-foot">
      <span className="muted small">
        Built-in feature · opens <code>{f.route}</code>
      </span>
      <button type="button" className="link-btn" onClick={onReset}>
        <RotateCcw size={12} /> Reset to app default
      </button>
    </div>
  </div>
);

const LinkEditor: React.FC<
  {
    link: Link;
    colorKeys: string[];
    icons: string[];
    actions: CustomTile["action"]["type"][];
    onChange: (patch: Partial<Link>) => void;
    onMove: (p: FeaturePlacement) => void;
    onRemove: () => void;
  } & LaunchProps
> = ({ link: l, colorKeys, icons, actions, onChange, onMove, onRemove, savedLaunch, stats }) => (
  <div className="feature-edit">
    <div className="field-row">
      <label className="field">
        <span>Title *</span>
        <input value={l.title} maxLength={40} placeholder="e.g. Join our WhatsApp" onChange={(e) => onChange({ title: e.target.value })} autoFocus={!l.title} />
      </label>
      <MoveSelect value={l.placement} onMove={onMove} />
    </div>
    <label className="field">
      <span>Description</span>
      <input value={l.description ?? ""} maxLength={80} placeholder="One short line" onChange={(e) => onChange({ description: e.target.value })} />
    </label>
    <ActionEditor value={l.action} allowed={actions} onChange={(action) => onChange({ action })} />
    <IconPicker value={l.icon} icons={icons} onChange={(icon) => onChange({ icon })} />
    <StyleFields size={l.size} colorKey={l.colorKey} badge={l.badge} colorKeys={colorKeys} onChange={onChange} />
    <LaunchEditor value={l.launch} saved={savedLaunch} stats={stats} description={l.description ?? ""} onChange={(launch) => onChange({ launch })} />
    <AudienceEditor value={l.audience} onChange={(audience) => onChange({ audience })} />
    <div className="feature-edit-foot">
      <span className="muted small">{describeAction(l.action)}</span>
      <button type="button" className="link-btn danger" onClick={onRemove}>
        <Trash2 size={12} /> Remove link tile
      </button>
    </div>
  </div>
);
