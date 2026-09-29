import {
  Activity,
  AlertCircle,
  Apple,
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseMedical,
  Calendar,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Droplet,
  Dumbbell,
  ExternalLink,
  Facebook,
  FileText,
  Flame,
  Gift,
  GitMerge,
  Globe,
  Heart,
  HelpCircle,
  Info,
  Instagram,
  Leaf,
  Link as LinkIcon,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Orbit,
  Phone,
  Pause,
  PlayCircle,
  ShoppingCart,
  Smile,
  Sparkles,
  Star,
  Store,
  Tag,
  Bell,
  TrendingUp,
  Trophy,
  Twitter,
  Users,
  UsersRound,
  X,
  Youtube,
  type LucideIcon
} from "lucide-react";
import React, { createContext, useContext, useState } from "react";
import type { Banner, CustomTile, Feature, FeaturePlacement, FeatureSize, HomeSection, Launch, LayoutScreen, ScreenSection, ThemeMode } from "../lib/api";
import { PLACEMENT_LABEL } from "../lib/catalog";

/*
 * A close-enough rendering of the app's Home, hub and Profile screens,
 * driven by the draft config, so every editor shows what a change will look
 * like before it's published. It mirrors the app's layout rules (small tiles
 * in a 2-column grid, large ones full width, banners as a swipeable row) but
 * isn't pixel perfect: fonts and spacing come from the phone.
 */

// The app's Ionicons names → the closest lucide icon, preview only.
export const ICONS: Record<string, LucideIcon> = {
  "trending-up-outline": TrendingUp,
  "sparkles-outline": Sparkles,
  "pulse-outline": Activity,
  "clipboard-outline": ClipboardList,
  "bar-chart-outline": BarChart3,
  "document-text-outline": FileText,
  "chatbubbles-outline": MessagesSquare,
  "help-circle-outline": HelpCircle,
  "alert-circle-outline": AlertCircle,
  "leaf-outline": Leaf,
  "heart-outline": Heart,
  "call-outline": Phone,
  "book-outline": BookOpen,
  "play-circle-outline": PlayCircle,
  "git-merge-outline": GitMerge,
  "checkmark-done-outline": CheckCheck,
  "star-outline": Star,
  "link-outline": LinkIcon,
  "globe-outline": Globe,
  "open-outline": ExternalLink,
  "logo-whatsapp": MessageCircle,
  "logo-youtube": Youtube,
  "logo-instagram": Instagram,
  "logo-facebook": Facebook,
  "logo-twitter": Twitter,
  "mail-outline": Mail,
  "gift-outline": Gift,
  "pricetag-outline": Tag,
  "cart-outline": ShoppingCart,
  "storefront-outline": Store,
  "medkit-outline": BriefcaseMedical,
  "fitness-outline": Dumbbell,
  "nutrition-outline": Apple,
  "calendar-outline": Calendar,
  "people-outline": Users,
  "information-circle-outline": Info,
  "megaphone-outline": Megaphone,
  "trophy-outline": Trophy,
  // Gen Z pack
  sparkles: Sparkles,
  "planet-outline": Orbit,
  "people-circle-outline": UsersRound
};

type Palette = Record<string, string>;

const tint = (p: Palette, key: string) => ({ fg: p[key] ?? p.primary, bg: p[`${key}Light`] ?? p.primaryLight });

/** Whose view the preview shows: someone who has the feature (tester / in the rollout), or everyone else. */
export type ViewAs = "access" | "others";

type TileSheet = { kind: "soon" | "paused"; headline: string; message: string | null; notifyMe: boolean; alternative: string | null };

/** What a preview tile needs, from either a built-in feature or a link tile. */
export type PreviewTile = {
  key: string;
  title: string;
  description: string;
  icon: string;
  colorKey: string;
  size: FeatureSize;
  badge: string | null;
  order: number;
  external: boolean;
  hiddenFor?: string;
  /** Locked (Coming soon) or paused for this view; a tap opens `sheet`. */
  lock?: "soon" | "paused";
  beta?: boolean;
  sheet?: TileSheet;
};

const HEADLINES = { soon: "Coming soon", this_month: "Coming this month", next_month: "Coming next month" } as const;

/**
 * How an item shows for `viewAs` (mirrors the app, docs/launch-states.md
 * §7.3): null = not shown. People with access see it open (BETA while
 * rolling out); everyone else sees its launch state.
 */
const launchLook = (l: Launch, description: string, viewAs: ViewAs): Pick<PreviewTile, "lock" | "beta" | "sheet"> | null => {
  if (viewAs === "access" || l.state === "live") return { beta: l.state === "rolling_out" && l.rollout.betaLabel };
  if (l.state === "rolling_out" && l.rollout.othersSee === "hidden") return null;
  if (l.state === "paused") {
    return {
      lock: "paused",
      sheet: {
        kind: "paused",
        headline: l.paused.title || "Taking a short break",
        message: l.paused.message || "We're working on it. Please check back soon.",
        notifyMe: false,
        alternative:
          l.paused.alternative.type === "none"
            ? null
            : l.paused.alternativeLabel?.trim() || (l.paused.alternative.type === "route" ? "Go there instead" : "Get help another way")
      }
    };
  }
  return {
    lock: "soon",
    sheet: {
      kind: "soon",
      headline: l.soon.headline === "custom" ? l.soon.customHeadline || "Coming soon" : HEADLINES[l.soon.headline],
      message: l.soon.message || description || null,
      notifyMe: l.soon.notifyMe,
      alternative: null
    }
  };
};

/** Enabled features + link tiles for a placement, in the shared order, as `viewAs` sees them. */
export const tilesIn = (features: Feature[], links: CustomTile[], placement: FeaturePlacement, viewAs: ViewAs = "others"): PreviewTile[] => {
  const tiles: PreviewTile[] = [];
  for (const f of features) {
    if (!f.enabled || f.placement !== placement) continue;
    const look = f.launch ? launchLook(f.launch, f.description, viewAs) : {};
    if (!look) continue;
    tiles.push({ key: f.key, title: f.title, description: f.description, icon: f.icon, colorKey: f.colorKey, size: f.size, badge: f.badge, order: f.order, external: false, ...look });
  }
  links.forEach((t, i) => {
    if (!t.enabled || t.placement !== placement) return;
    const look = t.launch ? launchLook(t.launch, t.description ?? "", viewAs) : {};
    if (!look) return;
    tiles.push({
      key: `link:${t.id ?? i}`,
      title: t.title || "Untitled link",
      description: t.description ?? "",
      icon: t.icon,
      colorKey: t.colorKey,
      size: t.size,
      badge: t.badge,
      order: t.order,
      external: t.action.type === "url" || t.action.type === "app",
      ...look
    });
  });
  return tiles.sort((a, b) => a.order - b.order);
};

/** Tapping a locked tile in the preview opens its sheet (see LaunchSheetHost). */
const SheetContext = createContext<(tile: PreviewTile) => void>(() => undefined);

/** The Coming soon / Paused bottom sheet, drawn inside the phone. */
const LaunchSheet: React.FC<{ tile: PreviewTile; palette: Palette; onClose: () => void }> = ({ tile, palette, onClose }) => {
  const Icon = ICONS[tile.icon] ?? Sparkles;
  const { fg, bg } = tint(palette, tile.colorKey);
  const s = tile.sheet!;
  return (
    <div className="pv-sheet-overlay" onClick={onClose}>
      <div className="pv-sheet" style={{ background: palette.surface, color: palette.foreground }} onClick={(e) => e.stopPropagation()}>
        <span className="pv-sheet-grip" style={{ background: palette.border }} />
        <span className="pv-sheet-icon" style={{ background: bg, color: fg }}>
          <Icon size={18} />
        </span>
        {s.kind === "soon" ? (
          <>
            <strong>{tile.title}</strong>
            <em style={{ color: palette.primary }}>{s.headline}</em>
          </>
        ) : (
          <strong>{s.headline}</strong>
        )}
        {s.message && <p style={{ color: palette.mutedText }}>{s.message}</p>}
        {s.notifyMe && (
          <span className="pv-sheet-btn" style={{ background: palette.button, color: palette.buttonText }}>
            <Bell size={10} /> Notify me
          </span>
        )}
        {s.alternative && (
          <span className="pv-sheet-btn" style={{ background: palette.button, color: palette.buttonText }}>
            {s.alternative}
          </span>
        )}
        <span className="pv-sheet-close" style={{ color: palette.mutedText }} onClick={onClose}>
          {s.kind === "soon" ? "Maybe later" : "OK"}
        </span>
      </div>
    </div>
  );
};

/** Lets locked tiles inside `children` open their sheet over the phone screen (used by PhoneFrame). */
const LaunchSheetHost: React.FC<{ palette: Palette; children: React.ReactNode }> = ({ palette, children }) => {
  const [open, setOpen] = useState<PreviewTile | null>(null);
  return (
    <SheetContext.Provider value={setOpen}>
      {children}
      {open && <LaunchSheet tile={open} palette={palette} onClose={() => setOpen(null)} />}
    </SheetContext.Provider>
  );
};

/** SOON / BETA pill, or the pause dot, on a tile. */
const LaunchMark: React.FC<{ tile: PreviewTile; palette: Palette }> = ({ tile, palette }) => {
  if (tile.lock === "soon")
    return (
      <em className="pv-badge pv-soon-pill" style={{ background: palette.mutedText, color: palette.surface }}>
        <Lock size={6} /> SOON
      </em>
    );
  if (tile.beta)
    return (
      <em className="pv-badge" style={{ background: palette.secondary, color: palette.buttonText }}>
        BETA
      </em>
    );
  return null;
};

export const PhoneFrame: React.FC<{ palette: Palette; children: React.ReactNode; label?: string }> = ({ palette, children, label }) => (
  <div className="phone" aria-label={label ?? "App preview"}>
    <div className="phone-notch" />
    <div className="phone-screen" style={{ background: palette.background, color: palette.text }}>
      <div className="phone-status" style={{ color: palette.foreground }}>
        <span>9:41</span>
        <span className="phone-status-icons">●●● ▮</span>
      </div>
      <LaunchSheetHost palette={palette}>{children}</LaunchSheetHost>
    </div>
  </div>
);

/* --------------------------------- Banners -------------------------------- */

export const BannerPreview: React.FC<{ banner: Partial<Banner>; palette: Palette; full?: boolean }> = ({ banner, palette, full }) => {
  const bg = banner.backgroundColor || palette.primary;
  const fg = banner.textColor || palette.buttonText;
  const width = full ? "100%" : undefined;

  if (banner.placement === "popup") return <PopupPreview banner={banner} palette={palette} />;
  if (banner.layout === "image" && banner.imageUrl) {
    return (
      <div className="pv-banner pv-banner-image" style={{ width }}>
        <img src={banner.imageUrl} alt={banner.title ?? ""} />
      </div>
    );
  }
  if (banner.layout === "strip") {
    return (
      <div className="pv-banner pv-banner-strip" style={{ background: bg, color: fg, width }}>
        <span className="pv-strip-title">{banner.title || "Banner title"}</span>
        {banner.ctaLabel && (
          <span className="pv-strip-cta">
            {banner.ctaLabel} <ArrowRight size={10} />
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="pv-banner pv-banner-card" style={{ background: bg, color: fg, width }}>
      <div className="pv-banner-text">
        <strong>{banner.title || "Banner title"}</strong>
        {banner.subtitle && <span>{banner.subtitle}</span>}
        {banner.ctaLabel && (
          <em className="pv-banner-cta" style={{ background: fg, color: bg }}>
            {banner.ctaLabel}
          </em>
        )}
      </div>
      {banner.imageUrl && <img src={banner.imageUrl} alt="" />}
    </div>
  );
};

/** The once-per-device pop-up, as drawn over Home in the app. */
export const PopupPreview: React.FC<{ banner: Partial<Banner>; palette: Palette }> = ({ banner, palette }) => {
  const bg = banner.backgroundColor || palette.surface;
  const fg = banner.textColor || palette.foreground;
  const tappable = banner.action?.type !== "none";
  return (
    <div className="pv-popup" style={{ background: bg, color: fg }}>
      <span className="pv-popup-x">
        <X size={10} />
      </span>
      {banner.imageUrl && <img src={banner.imageUrl} alt="" className={banner.layout === "image" ? "is-tall" : ""} />}
      {banner.layout !== "image" && (
        <div className="pv-popup-text">
          <strong>{banner.title || "Pop-up title"}</strong>
          {banner.subtitle && <span>{banner.subtitle}</span>}
        </div>
      )}
      <div className="pv-popup-actions">
        <span style={{ borderColor: palette.border, background: palette.surface, color: palette.foreground }}>{tappable ? "Not now" : "Close"}</span>
        {tappable && <span style={{ background: palette.button, color: palette.buttonText }}>{banner.ctaLabel || "Open"}</span>}
      </div>
    </div>
  );
};

const BannerRow: React.FC<{ banners: Partial<Banner>[]; palette: Palette }> = ({ banners, palette }) => {
  if (banners.length === 0) return null;
  return (
    <div className={`pv-banner-row ${banners.length === 1 ? "is-single" : ""}`}>
      {banners.map((b, i) => (
        <BannerPreview key={b._id ?? i} banner={b} palette={palette} full={banners.length === 1} />
      ))}
    </div>
  );
};

/* ---------------------------------- Tiles --------------------------------- */

const Tile: React.FC<{ tile: PreviewTile; palette: Palette }> = ({ tile, palette }) => {
  const openSheet = useContext(SheetContext);
  const Icon = ICONS[tile.icon] ?? Sparkles;
  const { fg, bg } = tint(palette, tile.colorKey);
  const large = tile.size === "large";
  // A locked or paused tile shows SOON / the pause dot instead of its own badge, and taps open the sheet.
  const marked = Boolean(tile.lock || tile.beta);
  return (
    <div
      className={`pv-tile ${large ? "is-large" : ""} ${tile.lock === "soon" ? "is-locked" : ""} ${tile.sheet ? "is-tappable" : ""}`}
      style={{ background: large ? bg : palette.surface, borderColor: palette.border }}
      onClick={tile.sheet ? () => openSheet(tile) : undefined}
      title={tile.sheet ? "Tap to see what people see" : undefined}
    >
      {tile.lock === "paused" && (
        <span className="pv-pause-dot" style={{ background: palette.warning, borderColor: palette.surface }}>
          <Pause size={5} />
        </span>
      )}
      <span className="pv-tile-icon" style={{ background: large ? palette.surface : bg, color: fg }}>
        <Icon size={13} />
      </span>
      <span className="pv-tile-text">
        <strong style={{ color: palette.foreground }}>
          {tile.title}
          <LaunchMark tile={tile} palette={palette} />
          {!marked && tile.badge && (
            <em className="pv-badge" style={{ background: palette.primary, color: palette.buttonText }}>
              {tile.badge}
            </em>
          )}
        </strong>
        <span style={{ color: palette.mutedText }}>{tile.description}</span>
      </span>
      {large ? (
        tile.lock !== "soon" && (
          <span className="pv-tile-go" style={{ background: palette.primary, color: palette.buttonText }}>
            {tile.external ? <ExternalLink size={9} /> : <ArrowRight size={10} />}
          </span>
        )
      ) : (
        tile.external && !tile.lock && <ExternalLink size={9} className="pv-tile-ext" color={palette.mutedText} />
      )}
    </div>
  );
};

/** Consecutive small tiles share a 2-column grid; a large one breaks the run (same as the app). */
export const TileGrid: React.FC<{ tiles: PreviewTile[]; palette: Palette }> = ({ tiles, palette }) => {
  const blocks: (PreviewTile | PreviewTile[])[] = [];
  for (const t of tiles) {
    const last = blocks[blocks.length - 1];
    if (t.size === "small" && Array.isArray(last)) last.push(t);
    else blocks.push(t.size === "small" ? [t] : t);
  }
  return (
    <div className="pv-tiles">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <div key={i} className="pv-grid">
            {b.map((t) => (
              <Tile key={t.key} tile={t} palette={palette} />
            ))}
          </div>
        ) : (
          <Tile key={b.key} tile={b} palette={palette} />
        )
      )}
    </div>
  );
};

export const liveBannersIn = (banners: Partial<Banner>[], placement: string) =>
  banners.filter((b) => b.placement === placement && b.status === "live").sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

/** Home / Profile shortcuts: rows of four round icons with labels, no box or heading (same as the app). */
const Shortcuts: React.FC<{ tiles: PreviewTile[]; palette: Palette }> = ({ tiles, palette }) => {
  const openSheet = useContext(SheetContext);
  return tiles.length === 0 ? null : (
    <div className="pv-shortcuts">
      {tiles.map((tile) => {
        const Icon = ICONS[tile.icon] ?? Sparkles;
        const { fg, bg } = tint(palette, tile.colorKey);
        const mark = tile.lock === "soon" ? "SOON" : tile.beta ? "BETA" : tile.lock === "paused" ? null : tile.badge;
        return (
          <div
            key={tile.key}
            className={`pv-shortcut ${tile.lock === "soon" ? "is-locked" : ""} ${tile.sheet ? "is-tappable" : ""}`}
            onClick={tile.sheet ? () => openSheet(tile) : undefined}
          >
            <span className="pv-shortcut-icon" style={{ background: bg, color: fg }}>
              <Icon size={14} />
              {mark && (
                <em
                  className="pv-shortcut-badge"
                  style={{ background: tile.lock === "soon" ? palette.mutedText : tile.beta ? palette.secondary : palette.primary, color: palette.buttonText, borderColor: palette.background }}
                >
                  {mark}
                </em>
              )}
              {tile.lock === "paused" && (
                <span className="pv-pause-dot" style={{ background: palette.warning, borderColor: palette.background }}>
                  <Pause size={5} />
                </span>
              )}
            </span>
            <span style={{ color: palette.foreground }}>{tile.title}</span>
          </div>
        );
      })}
    </div>
  );
};

/* --------------------------------- Screens -------------------------------- */

type ScreenProps = {
  features: Feature[];
  links: CustomTile[];
  banners: Partial<Banner>[];
  palette: Palette;
  /** Whose view to draw; defaults to everyone else (what most people see). */
  viewAs?: ViewAs;
};

/** The keys of the shown blocks, in order; every block while `sections` hasn't loaded (an older backend). */
const shownKeys = (sections: ScreenSection[] | undefined, fallback: string[]) =>
  sections ? sections.filter((s) => s.visible).map((s) => s.key) : fallback;

/** A block's text override, else `fallback`. */
const textOf = (sections: HomeSection[] | undefined, key: string, fallback: string) =>
  sections?.find((s) => s.key === key)?.text?.trim() || fallback;

/** Hub title overrides, e.g. `{ care_hub: "Health" }`. */
export type HubTitles = Partial<Record<FeaturePlacement, string | null>>;

const HUB_INTRO: Partial<Record<FeaturePlacement, string>> = {
  care_hub: "Forecasts and insights for your health.",
  wellness_hub: "Support for your body and mind — private, judgment-free, and always here.",
  explore_hub: "Community, content, and everything to explore beyond tracking."
};

export const HubScreen: React.FC<ScreenProps & { placement: FeaturePlacement; sections?: ScreenSection[]; title?: string | null }> = ({
  placement,
  sections,
  title,
  features,
  links,
  banners,
  palette,
  viewAs
}) => {
  const tiles = tilesIn(features, links, placement, viewAs);
  const render = (key: string) => {
    switch (key) {
      case "intro":
        return (
          <p className="pv-intro" style={{ color: palette.mutedText }}>
            {textOf(sections, "intro", HUB_INTRO[placement] ?? "")}
          </p>
        );
      case "promo":
        return <BannerRow banners={liveBannersIn(banners, placement)} palette={palette} />;
      case "tiles":
        return tiles.length > 0 ? (
          <TileGrid tiles={tiles} palette={palette} />
        ) : (
          <p className="pv-empty" style={{ color: palette.mutedText }}>
            Nothing here — this hub's card is hidden on Home.
          </p>
        );
      default:
        return null;
    }
  };
  return (
    <div className="pv-body">
      <div className="pv-header" style={{ color: palette.foreground }}>
        <span className="pv-back" style={{ background: palette.surface, borderColor: palette.border }}>
          <ChevronLeft size={12} />
        </span>
        <strong>{title?.trim() || PLACEMENT_LABEL[placement]}</strong>
      </div>
      {shownKeys(sections, ["intro", "promo", "tiles"]).map((key) => (
        <React.Fragment key={key}>{render(key)}</React.Fragment>
      ))}
    </div>
  );
};

const PROFILE_MENUS: Record<string, { title: string; rows: string[] }> = {
  account: { title: "Your account", rows: ["Achievements", "My subscription", "Government schemes & benefits"] },
  preferences: { title: "Preferences", rows: ["Notifications & display"] },
  privacyHelp: { title: "Privacy & help", rows: ["App lock", "Data privacy & security", "Help & support"] }
};

export const ProfileScreen: React.FC<ScreenProps & { sections?: ScreenSection[] }> = ({ sections, features, links, banners, palette, viewAs }) => {
  const render = (key: string) => {
    const menu = PROFILE_MENUS[key];
    if (menu) {
      return (
        <div>
          <div className="pv-section-title" style={{ color: palette.foreground }}>
            {textOf(sections, key, menu.title)}
          </div>
          <div className="pv-menu" style={{ background: palette.surface, borderColor: palette.border }}>
            {menu.rows.map((row) => (
              <div key={row} style={{ borderColor: palette.border, color: palette.foreground }}>
                {row} <ChevronRight size={10} color={palette.mutedText} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    switch (key) {
      case "identity":
        return (
          <div className="pv-profile-head" style={{ color: palette.foreground }}>
            <span className="pv-avatar" style={{ background: palette.primaryLight, color: palette.primary }}>
              P
            </span>
            <strong>Priya Tester</strong>
            <span style={{ color: palette.mutedText }}>priya@example.com</span>
          </div>
        );
      case "completeProfile":
        return (
          <div className="pv-insight-card" style={{ background: palette.primaryLight, borderColor: palette.primaryLight }}>
            <strong style={{ color: palette.foreground }}>Complete your profile</strong>
            <span style={{ color: palette.mutedText }}>Only shows while the photo or phone is missing.</span>
          </div>
        );
      case "stats":
        return (
          <div className="pv-stats">
            {[
              ["12", "Days tracked"],
              ["120", "Care points"],
              ["5", "Day streak"]
            ].map(([value, label]) => (
              <span key={label} style={{ background: palette.surface, color: palette.mutedText }}>
                <b style={{ color: palette.foreground }}>{value}</b>
                {label}
              </span>
            ))}
          </div>
        );
      case "promo":
        return <BannerRow banners={liveBannersIn(banners, "profile")} palette={palette} />;
      case "shortcuts":
        return <Shortcuts tiles={tilesIn(features, links, "profile", viewAs)} palette={palette} />;
      case "logout":
        return (
          <span className="pv-logout" style={{ color: palette.primary }}>
            Log out
          </span>
        );
      default:
        return null;
    }
  };
  return (
    <div className="pv-body">
      {shownKeys(sections, ["identity", "completeProfile", "stats", "account", "preferences", "privacyHelp", "promo", "shortcuts", "logout"]).map((key) => (
        <React.Fragment key={key}>{render(key)}</React.Fragment>
      ))}
    </div>
  );
};

export const HomeScreen: React.FC<ScreenProps & { sections: HomeSection[]; mode: ThemeMode; showPopup?: boolean; hubTitles?: HubTitles }> = ({
  sections,
  hubTitles,
  features,
  links,
  banners,
  palette,
  mode,
  showPopup,
  viewAs
}) => {
  const hero =
    mode === "dark"
      ? `linear-gradient(135deg, ${palette.surfaceStrong ?? palette.surface}, ${palette.surface})`
      : `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`;
  const popup = showPopup ? liveBannersIn(banners, "popup")[0] : undefined;

  const render = (key: string) => {
    switch (key) {
      case "statPills":
        return (
          <div className="pv-pills">
            {[
              { icon: Flame, label: "5 day streak" },
              { icon: Coins, label: "120 points" }
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="pv-pill" style={{ background: palette.surface, borderColor: palette.border, color: palette.foreground }}>
                <Icon size={10} color={palette.primary} /> {label}
              </span>
            ))}
          </div>
        );
      case "weekStrip":
        return (
          <div className="pv-week">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span
                key={i}
                style={
                  i === 3
                    ? { background: palette.primary, color: palette.buttonText }
                    : { background: palette.surface, color: palette.mutedText, borderColor: palette.border }
                }
              >
                {d}
                <b>{21 + i}</b>
              </span>
            ))}
          </div>
        );
      case "phaseHero":
        return (
          <div className="pv-hero" style={{ background: hero, color: mode === "dark" ? palette.foreground : "#fff" }}>
            <span>Day 14 · Ovulation</span>
            <strong>Peak energy today</strong>
            <em>Fertile window: 6 days</em>
          </div>
        );
      case "quickActions":
        return (
          <div className="pv-actions">
            {[
              { icon: Droplet, label: "Log period", primary: true },
              { icon: Activity, label: "Symptoms" },
              { icon: Smile, label: "Mood" }
            ].map(({ icon: Icon, label, primary }) => (
              <span
                key={label}
                style={
                  primary
                    ? { background: palette.button, color: palette.buttonText }
                    : { background: palette.surface, color: palette.foreground, borderColor: palette.border }
                }
              >
                <Icon size={11} /> {label}
              </span>
            ))}
          </div>
        );
      case "shortcuts":
        return <Shortcuts tiles={tilesIn(features, links, "home", viewAs)} palette={palette} />;
      case "promo_top":
        return <BannerRow banners={liveBannersIn(banners, "home_top")} palette={palette} />;
      case "promo_middle":
        return <BannerRow banners={liveBannersIn(banners, "home_middle")} palette={palette} />;
      case "insights":
        return (
          <div className="pv-insights">
            <div className="pv-section-title" style={{ color: palette.foreground }}>
              {textOf(sections, "insights", "Insights")} <span style={{ color: palette.primary }}>See all</span>
            </div>
            <div className="pv-insight-card" style={{ background: palette.surface, borderColor: palette.border }}>
              <strong style={{ color: palette.foreground }}>Cycle health</strong>
              <span style={{ color: palette.mutedText }}>Regular · 28 day average</span>
            </div>
          </div>
        );
      case "moreForYou": {
        const hubs = (["care_hub", "wellness_hub", "explore_hub"] as FeaturePlacement[]).filter((p) => tilesIn(features, links, p, viewAs).length > 0);
        if (hubs.length === 0) return null;
        return (
          <div className="pv-more">
            <div className="pv-section-title" style={{ color: palette.foreground }}>
              {textOf(sections, "moreForYou", "More for you")}
            </div>
            {hubs.map((p) => (
              <div key={p} className="pv-hub-row" style={{ background: palette.surface, borderColor: palette.border }}>
                <strong style={{ color: palette.foreground }}>{hubTitles?.[p]?.trim() || PLACEMENT_LABEL[p]}</strong>
                <span style={{ color: palette.mutedText }}>{tilesIn(features, links, p, viewAs).length} tiles</span>
                <ArrowRight size={11} color={palette.primary} />
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="pv-body pv-home">
      <div className="pv-greeting" style={{ color: palette.foreground }}>
        <span style={{ color: palette.mutedText }}>Good morning</span>
        <strong>Priya</strong>
      </div>
      {sections
        .filter((s) => s.visible)
        .map((s) => (
          <React.Fragment key={s.key}>{render(s.key)}</React.Fragment>
        ))}
      {popup && (
        <div className="pv-popup-overlay">
          <PopupPreview banner={popup} palette={palette} />
        </div>
      )}
    </div>
  );
};

/** Render whichever screen a placement lives on. */
export const ScreenFor: React.FC<
  ScreenProps & {
    placement: FeaturePlacement;
    sections: HomeSection[];
    screenSections?: Record<LayoutScreen, ScreenSection[]>;
    hubTitles?: HubTitles;
    mode: ThemeMode;
  }
> = ({ screenSections, hubTitles, ...props }) => {
  if (props.placement === "home") return <HomeScreen {...props} hubTitles={hubTitles} />;
  const sections = screenSections?.[props.placement];
  if (props.placement === "profile") return <ProfileScreen {...props} sections={sections} />;
  return <HubScreen {...props} sections={sections} title={hubTitles?.[props.placement]} />;
};
