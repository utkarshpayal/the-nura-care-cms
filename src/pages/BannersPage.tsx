import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, Eye, ImagePlus, LayoutTemplate, Loader2, MousePointerClick, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  EVERYONE,
  Banner,
  BannerInput,
  BannerLayout,
  BannerPlacement,
  BannerStatus,
  FeaturePlacement,
  LayoutScreen,
  createBanner,
  deleteBanner,
  errorMessage,
  updateBanner,
  uploadImage
} from "../lib/api";
import { BANNER_PLACEMENT_LABEL, fromLocalInput, hubTitlesOf, isColor, relativeTime, resolvePalette, toHex6, toLocalInput } from "../lib/catalog";
import { useCms } from "../lib/store";
import {
  BANNER_TEMPLATES,
  BannerTemplate,
  BannerTemplateGroup,
  PLACEHOLDER,
  TEMPLATE_GROUP_LABEL,
  isTemplateImage,
  templateImageFile,
  templateImageUrl
} from "../lib/bannerTemplates";
import { LAUNCH_STATE_LABEL, featureForRoute, isFullyLive } from "../lib/launch";
import { BannerPreview, HomeScreen, HubScreen, PhoneFrame, ProfileScreen } from "../components/AppPreview";
import { ActionEditor, AudienceEditor, actionError, audienceError, describeAction, describeAudience } from "../components/editors";
import { PageHeader, Segmented, Switch, useToast } from "../components/ui";

const STATUS_LABEL: Record<BannerStatus, string> = {
  live: "Live",
  scheduled: "Scheduled",
  expired: "Ended",
  inactive: "Paused"
};

const PLACEMENTS: BannerPlacement[] = ["home_top", "home_middle", "popup", "care_hub", "wellness_hub", "explore_hub", "profile"];

const EMPTY: BannerInput = {
  title: "",
  subtitle: "",
  ctaLabel: "",
  imageUrl: "",
  placement: "home_top",
  layout: "card",
  action: { type: "route", value: "/subscription", fallbackUrl: null },
  audience: EVERYONE,
  backgroundColor: "",
  textColor: "",
  priority: 0,
  active: true,
  dismissible: false,
  startAt: null,
  endAt: null
};


/** Status the draft would have right now (for the preview and the save note). */
const draftStatus = (b: BannerInput): BannerStatus => {
  const now = Date.now();
  if (!b.active) return "inactive";
  if (b.startAt && new Date(b.startAt).getTime() > now) return "scheduled";
  if (b.endAt && new Date(b.endAt).getTime() <= now) return "expired";
  return "live";
};

const ColorInput: React.FC<{ label: string; value: string; placeholder: string; onChange: (v: string) => void }> = ({
  label,
  value,
  placeholder,
  onChange
}) => (
  <label className="field">
    <span>{label}</span>
    <div className="color-input">
      <input type="color" value={toHex6(value || placeholder)} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
      <input value={value} placeholder={`${placeholder} (theme)`} onChange={(e) => onChange(e.target.value)} className={value && !isColor(value) ? "is-invalid" : ""} />
    </div>
  </label>
);

/** `template` prefills a new banner (see lib/bannerTemplates.ts). */
const BannerEditor: React.FC<{ initial: Banner | null; template?: BannerInput; onClose: () => void }> = ({ initial, template, onClose }) => {
  const { config, banners, setBanners, canManage } = useCms();
  const toast = useToast();
  const [draft, setDraft] = useState<BannerInput>(() =>
    initial
      ? {
          ...EMPTY,
          ...initial,
          subtitle: initial.subtitle ?? "",
          ctaLabel: initial.ctaLabel ?? "",
          imageUrl: initial.imageUrl ?? "",
          backgroundColor: initial.backgroundColor ?? "",
          textColor: initial.textColor ?? "",
          action: { ...initial.action, fallbackUrl: initial.action.fallbackUrl ?? null },
          audience: initial.audience ?? EVERYONE
        }
      : template
        ? { ...EMPTY, ...template, subtitle: template.subtitle ?? "", ctaLabel: template.ctaLabel ?? "", imageUrl: template.imageUrl ?? "", backgroundColor: template.backgroundColor ?? "", textColor: template.textColor ?? "" }
        : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const palette = useMemo(() => resolvePalette("light", config!.theme), [config]);

  const set = (patch: Partial<BannerInput>) => setDraft((d) => ({ ...d, ...patch }));

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("error", "Pick an image file.");
    if (file.size > 5 * 1024 * 1024) return toast("error", "Images must be 5 MB or smaller.");
    setUploading(true);
    try {
      set({ imageUrl: await uploadImage(file) });
    } catch (err) {
      toast("error", errorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const blocker = (() => {
    if (!draft.title.trim()) return "Add a title";
    if (draft.layout === "image" && !draft.imageUrl) return "An image banner needs an image";
    if (PLACEHOLDER.test(draft.action.value ?? "") || PLACEHOLDER.test(draft.action.fallbackUrl ?? "")) return "Replace the YOUR-… placeholder in the link";
    const a = actionError(draft.action) ?? audienceError(draft.audience);
    if (a) return a;
    if (draft.backgroundColor && !isColor(draft.backgroundColor)) return "Background colour isn't valid";
    if (draft.textColor && !isColor(draft.textColor)) return "Text colour isn't valid";
    if (draft.startAt && draft.endAt && draft.endAt <= draft.startAt) return "The end must be after the start";
    return null;
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Template artwork is only uploaded on save, so a cancelled template leaves nothing in S3.
      let imageUrl = draft.imageUrl || null;
      if (imageUrl && isTemplateImage(imageUrl)) imageUrl = await uploadImage(await templateImageFile(imageUrl));
      const input: BannerInput = {
        ...draft,
        title: draft.title.trim(),
        subtitle: draft.subtitle?.trim() || null,
        ctaLabel: draft.ctaLabel?.trim() || null,
        imageUrl,
        backgroundColor: draft.backgroundColor || null,
        textColor: draft.textColor || null,
        action: draft.action.type === "none" ? { type: "none", value: null, fallbackUrl: null } : draft.action
      };
      const { banner } = initial ? await updateBanner(initial._id, input) : await createBanner(input);
      setBanners((all) => (initial ? all.map((b) => (b._id === banner._id ? { ...b, ...banner } : b)) : [banner, ...all]));
      toast("success", banner.status === "live" ? "Banner is live in the app." : `Banner saved (${STATUS_LABEL[banner.status].toLowerCase()}).`);
      onClose();
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't save the banner."));
    } finally {
      setSaving(false);
    }
  };

  // Preview the banner in its real spot, alongside the other live ones there.
  // The draft always shows, even if it's scheduled or paused.
  const previewBanners = [
    { ...draft, _id: initial?._id ?? "draft", status: "live" } as Partial<Banner>,
    ...banners.filter((b) => b._id !== initial?._id)
  ];
  const isHome = draft.placement === "home_top" || draft.placement === "home_middle" || draft.placement === "popup";
  const screenProps = { features: config!.features, links: config!.customTiles, banners: previewBanners, palette };

  return (
    <div className="drawer-overlay" onClick={() => !saving && onClose()}>
      <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="banner-editor-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2 id="banner-editor-title">{initial ? "Edit banner" : template ? "New banner from template" : "New banner"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
            <X size={18} />
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-form">
            <label className="field">
              <span>Title *</span>
              <input value={draft.title} maxLength={60} placeholder="e.g. Unlock Premium — 20% off" onChange={(e) => set({ title: e.target.value })} autoFocus />
            </label>
            <label className="field">
              <span>Subtitle</span>
              <input value={draft.subtitle ?? ""} maxLength={140} placeholder="One short line" onChange={(e) => set({ subtitle: e.target.value })} />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Where it shows</span>
                <select value={draft.placement} onChange={(e) => set({ placement: e.target.value as BannerPlacement })}>
                  {PLACEMENTS.map((p) => (
                    <option key={p} value={p}>
                      {BANNER_PLACEMENT_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Style</span>
                <Segmented<BannerLayout>
                  label="Banner style"
                  value={draft.layout}
                  onChange={(layout) => set({ layout })}
                  options={[
                    { value: "card", label: "Card" },
                    { value: "image", label: "Image" },
                    { value: "strip", label: "Strip" }
                  ]}
                />
              </div>
            </div>

            <div className="field">
              <span>Image {draft.layout === "image" ? "* (the whole banner)" : "(optional, shown on the right)"}</span>
              <div className="upload-row">
                {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="upload-thumb" /> : <span className="upload-thumb empty"><ImagePlus size={16} /></span>}
                <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading || !canManage}>
                  {uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} {draft.imageUrl ? "Replace" : "Upload"}
                </button>
                {draft.imageUrl && (
                  <button type="button" className="link-btn" onClick={() => set({ imageUrl: "" })}>
                    Remove
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
              <small className="muted">Wide images work best (about 3:1). PNG, JPG or WebP, up to 5 MB.</small>
            </div>

            <ActionEditor value={draft.action} allowed={config!.catalog.bannerActions} onChange={(action) => set({ action })} />
            {(() => {
              // A banner that opens a screen not everyone can use yet wastes the slot (the app shows its sheet instead).
              const target = draft.action.type === "route" ? featureForRoute(config!.features, draft.action.value) : undefined;
              if (!target || isFullyLive(target.launch)) return null;
              return (
                <small className="warn">
                  {target.title} is {LAUNCH_STATE_LABEL[target.launch.state].toLowerCase()}
                  {target.launch.state === "rolling_out" ? ` (${target.launch.rollout.percent}%)` : ""}. People without it see its
                  {target.launch.state === "paused" ? " “short break”" : " Coming soon"} sheet instead of the screen.
                </small>
              );
            })()}
            <label className="field">
              <span>{draft.placement === "popup" ? "Main button label" : "Button label"}</span>
              <input value={draft.ctaLabel ?? ""} maxLength={24} placeholder={draft.placement === "popup" ? "e.g. Open (default)" : "e.g. Upgrade"} onChange={(e) => set({ ctaLabel: e.target.value })} disabled={draft.action.type === "none"} />
            </label>

            {draft.layout !== "image" && (
              <div className="field-row">
                <ColorInput label="Background" value={draft.backgroundColor ?? ""} placeholder={palette.primary} onChange={(v) => set({ backgroundColor: v })} />
                <ColorInput label="Text" value={draft.textColor ?? ""} placeholder={palette.buttonText} onChange={(v) => set({ textColor: v })} />
              </div>
            )}

            <div className="field-row">
              <label className="field">
                <span>Starts (optional)</span>
                <input type="datetime-local" value={toLocalInput(draft.startAt)} onChange={(e) => set({ startAt: fromLocalInput(e.target.value) })} />
              </label>
              <label className="field">
                <span>Ends (optional)</span>
                <input type="datetime-local" value={toLocalInput(draft.endAt)} onChange={(e) => set({ endAt: fromLocalInput(e.target.value) })} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Priority (0–100, higher shows first)</span>
                <input type="number" min={0} max={100} value={draft.priority} onChange={(e) => set({ priority: Math.max(0, Math.min(100, Math.floor(Number(e.target.value)) || 0)) })} />
              </label>
              <div className="field switches">
                <Switch checked={draft.active} onChange={(active) => set({ active })} label="Active" />
                {draft.placement !== "popup" && <Switch checked={draft.dismissible} onChange={(dismissible) => set({ dismissible })} label="Users can close it" />}
              </div>
            </div>

            <AudienceEditor value={draft.audience} onChange={(audience) => set({ audience })} />
          </div>

          <div className="drawer-preview">
            <p className="muted small">In {BANNER_PLACEMENT_LABEL[draft.placement]}</p>
            <PhoneFrame palette={palette}>
              {isHome ? (
                <HomeScreen {...screenProps} sections={config!.homeSections} hubTitles={hubTitlesOf(config!)} mode="light" showPopup={draft.placement === "popup"} />
              ) : draft.placement === "profile" ? (
                <ProfileScreen {...screenProps} sections={config!.screenSections?.profile} />
              ) : (
                <HubScreen {...screenProps} placement={draft.placement as FeaturePlacement} sections={config!.screenSections?.[draft.placement as LayoutScreen]} title={config!.screenTitles?.[draft.placement as LayoutScreen]?.title} />
              )}
            </PhoneFrame>
            {draft.placement === "popup" && <p className="muted small">Shown once per device, a moment after Home opens. A new campaign needs a new banner.</p>}
            {(draft.placement === "home_top" || draft.placement === "home_middle") && !config!.homeSections.find((s) => s.key === (draft.placement === "home_top" ? "promo_top" : "promo_middle"))?.visible && (
              <p className="warn small">This slot is hidden in Screen layouts, so the banner won't show until you turn it on there.</p>
            )}
            {!isHome && config!.screenSections?.[draft.placement as LayoutScreen]?.find((s) => s.key === "promo")?.visible === false && (
              <p className="warn small">Promo banners are hidden on this screen in Screen layouts, so the banner won't show until you turn them on there.</p>
            )}
          </div>
        </div>

        <footer className="drawer-foot">
          <span className="muted small">{blocker ?? (draftStatus(draft) === "live" ? "Goes live as soon as you save." : `Will be ${STATUS_LABEL[draftStatus(draft)].toLowerCase()} after saving.`)}</span>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || Boolean(blocker) || !canManage}>
              {saving && <Loader2 size={15} className="spin" />} {initial ? "Save banner" : "Create banner"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

const TemplateGallery: React.FC<{ onPick: (t: BannerTemplate) => void }> = ({ onPick }) => {
  const { config, canManage } = useCms();
  const palette = useMemo(() => resolvePalette("light", config!.theme), [config]);
  const [open, setOpen] = useState(true);
  const [group, setGroup] = useState<BannerTemplateGroup | "all">("all");
  const groups = Object.keys(TEMPLATE_GROUP_LABEL) as BannerTemplateGroup[];
  const shown = BANNER_TEMPLATES.filter((t) => group === "all" || t.group === group);

  return (
    <section className="card template-gallery">
      <button type="button" className="template-gallery-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <LayoutTemplate size={16} />
        <strong>Start from a template</strong>
        <span className="muted small">{BANNER_TEMPLATES.length} ready-made banners with artwork. Nothing goes live until you save.</span>
        <ChevronDown size={16} className={open ? "is-open" : ""} />
      </button>
      {open && (
        <>
          <div className="chip-row">
            {(["all", ...groups] as const).map((g) => (
              <button key={g} type="button" className={`chip ${group === g ? "is-active" : ""}`} onClick={() => setGroup(g)}>
                {g === "all" ? "All" : TEMPLATE_GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <div className="template-grid">
            {shown.map((t) => (
              <article key={t.key} className="template-tile">
                <div className="template-tile-preview" style={{ background: palette.background }}>
                  <BannerPreview banner={{ ...t.banner, imageUrl: templateImageUrl(t), placement: t.banner.placement }} palette={palette} full />
                </div>
                <div className="template-tile-body">
                  <strong>{t.name}</strong>
                  <span className="muted small">
                    {BANNER_PLACEMENT_LABEL[t.banner.placement]} · {t.banner.layout === "image" ? "Image" : t.banner.layout === "card" ? "Card" : "Strip"}
                  </span>
                  {t.setupNote && <span className="warn small">{t.setupNote}</span>}
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => onPick(t)} disabled={!canManage}>
                  <Plus size={15} /> Use template
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export const BannersPage: React.FC = () => {
  const { banners, setBanners, canManage, config } = useCms();
  const toast = useToast();
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [template, setTemplate] = useState<BannerInput | undefined>();

  // The editor shows the bundled artwork; handleSave uploads it to S3.
  const pickTemplate = (t: BannerTemplate) => {
    setTemplate({ ...t.banner, imageUrl: templateImageUrl(t) });
    setEditing("new");
  };
  const [filter, setFilter] = useState<"current" | "all">("current");
  const palette = useMemo(() => resolvePalette("light", config!.theme), [config]);

  const shown = banners.filter((b) => filter === "all" || b.status === "live" || b.status === "scheduled");

  const handleDelete = async (b: Banner) => {
    if (!window.confirm(`Delete “${b.title}”? It disappears from the app on its next refresh.`)) return;
    try {
      await deleteBanner(b._id);
      setBanners((all) => all.filter((x) => x._id !== b._id));
      toast("success", "Banner deleted.");
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't delete the banner."));
    }
  };

  const toggleActive = async (b: Banner) => {
    if (!b.active && (PLACEHOLDER.test(b.action.value ?? "") || PLACEHOLDER.test(b.action.fallbackUrl ?? ""))) {
      toast("error", "Replace the YOUR-… placeholder in its link first.");
      return setEditing(b);
    }
    try {
      const { banner } = await updateBanner(b._id, { ...b, active: !b.active });
      setBanners((all) => all.map((x) => (x._id === b._id ? { ...x, ...banner } : x)));
    } catch (err) {
      toast("error", errorMessage(err, "Couldn't update the banner."));
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Marketing"
        title="Banners & ads"
        actions={
          canManage && (
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={16} /> New banner
            </button>
          )
        }
      >
        Promo cards on Home and in the hubs. Schedule them, point them at a screen or a website, and see how many taps they get.
      </PageHeader>

      {canManage && <TemplateGallery onPick={pickTemplate} />}

      <div className="toolbar">
        <Segmented
          label="Which banners"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "current", label: `Live & scheduled (${banners.filter((b) => b.status === "live" || b.status === "scheduled").length})` },
            { value: "all", label: `All (${banners.length})` }
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <div className="card empty">
          <p>{banners.length === 0 ? "No banners yet. Create one to promote a plan, a feature or an offer." : "Nothing live or scheduled. Switch to All to see ended and paused banners."}</p>
        </div>
      ) : (
        <div className="banner-grid">
          {shown.map((b) => (
            <article key={b._id} className="card banner-card">
              <div className="banner-card-preview" style={{ background: palette.background }}>
                <BannerPreview banner={b} palette={palette} full />
              </div>
              <div className="banner-card-body">
                <div className="banner-card-top">
                  <span className={`pill pill-${b.status}`}>{STATUS_LABEL[b.status]}</span>
                  <span className="muted small">{BANNER_PLACEMENT_LABEL[b.placement]}</span>
                </div>
                <strong>{b.title}</strong>
                <span className="muted small">{describeAction(b.action)}</span>
                {describeAudience(b.audience) && <span className="muted small">For: {describeAudience(b.audience)}</span>}
                <div className="banner-stats">
                  <span>
                    <Eye size={12} /> {b.impressionCount.toLocaleString()} views
                  </span>
                  <span>
                    <MousePointerClick size={12} /> {b.clickCount.toLocaleString()} taps
                  </span>
                  {b.impressionCount > 0 && <span title="Taps ÷ views">CTR {((b.clickCount / b.impressionCount) * 100).toFixed(1)}%</span>}
                  <span>Priority {b.priority}</span>
                  {b.startAt && <span>From {new Date(b.startAt).toLocaleString()}</span>}
                  {b.endAt && <span>Until {new Date(b.endAt).toLocaleString()}</span>}
                </div>
                <span className="muted small">Updated {relativeTime(b.updatedAt)}</span>
              </div>
              {canManage && (
                <div className="banner-card-actions">
                  <Switch checked={b.active} onChange={() => toggleActive(b)} label="Active" />
                  <button type="button" className="link-btn" onClick={() => setEditing(b)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => handleDelete(b)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {editing && (
        <BannerEditor
          initial={editing === "new" ? null : editing}
          template={editing === "new" ? template : undefined}
          onClose={() => {
            setEditing(null);
            setTemplate(undefined);
          }}
        />
      )}
    </div>
  );
};
