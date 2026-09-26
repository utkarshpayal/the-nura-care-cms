// Backend client for the CMS. Everything goes to period-buddy-be:
//   /api/auth/login   staff sign-in (same accounts as the Admin Workspace)
//   /api/admin/me     refresh the signed-in staff member's permissions
//   /api/cms/*        read/write the app config (cms.read / cms.manage)

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "nura-cms.token";
const TIMEOUT_MS = 20_000;

export const CMS_READ = "cms.read";
export const CMS_MANAGE = "cms.manage";

/* --------------------------------- Types --------------------------------- */

/** A hub screen, or the Shortcuts block on Home / Profile. */
export type FeaturePlacement = "care_hub" | "wellness_hub" | "explore_hub" | "home" | "profile";
export type FeatureSize = "small" | "large";
export type BannerPlacement = "home_top" | "home_middle" | "popup" | Exclude<FeaturePlacement, "home">;
export type BannerLayout = "card" | "image" | "strip";
export type BannerStatus = "live" | "scheduled" | "expired" | "inactive";
export type ThemeMode = "light" | "dark";

export type AudienceSegment = "all" | "signed_in" | "premium" | "free";
export type AudiencePlatform = "android" | "ios" | "web";
export type Audience = {
  segment: AudienceSegment;
  platforms: AudiencePlatform[];
  minAppVersion: string | null;
  maxAppVersion: string | null;
};
export const EVERYONE: Audience = { segment: "all", platforms: [], minAppVersion: null, maxAppVersion: null };

export type ActionType = "none" | "route" | "url" | "app";
export type TapAction = { type: ActionType; value: string | null; fallbackUrl: string | null };

/** An admin-made link tile living next to the built-in features. */
export type CustomTile = {
  id?: string;
  title: string;
  description: string | null;
  icon: string;
  colorKey: string;
  placement: FeaturePlacement;
  size: FeatureSize;
  order: number;
  enabled: boolean;
  badge: string | null;
  action: TapAction;
  audience: Audience;
};

export type ConfigSection = "features" | "homeSections" | "theme" | "settings";

export type AppSettings = {
  maintenance: { enabled: boolean; title: string; message: string };
  update: {
    minVersion: string | null;
    latestVersion: string | null;
    title: string;
    message: string;
    androidUrl: string | null;
    iosUrl: string | null;
  };
};

export type Revision = {
  _id: string;
  section: ConfigSection;
  data: Record<string, unknown>;
  sectionVersion: number;
  note: string | null;
  restoredFrom: string | null;
  createdBy?: StaffRef;
  createdAt: string;
};

export type Feature = {
  key: string;
  icon: string;
  route: string;
  enabled: boolean;
  placement: FeaturePlacement;
  size: FeatureSize;
  colorKey: string;
  order: number;
  title: string;
  description: string;
  badge: string | null;
  audience: Audience;
  defaults: { title: string; description: string; placement: FeaturePlacement; size: FeatureSize; colorKey: string };
};

export type HomeSection = { key: string; label: string; visible: boolean; order: number };

export type ThemeOverrides = Record<ThemeMode, Record<string, string>>;

export type ThemeToken = { key: string; label: string; light: string; dark: string };

export type Catalog = {
  featurePlacements: FeaturePlacement[];
  featureSizes: FeatureSize[];
  tileColorKeys: string[];
  tileIcons: string[];
  tileActions: ActionType[];
  maxCustomTiles: number;
  bannerActions: ActionType[];
  audienceSegments: AudienceSegment[];
  audiencePlatforms: AudiencePlatform[];
  themeTokens: ThemeToken[];
  bannerPlacements: BannerPlacement[];
  bannerLayouts: BannerLayout[];
};

export type StaffRef = { _id: string; firstName?: string; lastName?: string; email?: string } | null;

export type CmsConfig = {
  version: number;
  /** Per-section lock counters: send the one you loaded when saving that section. */
  sectionVersions: Record<ConfigSection, number>;
  updatedAt: string | null;
  updatedBy?: StaffRef;
  features: Feature[];
  customTiles: CustomTile[];
  homeSections: HomeSection[];
  theme: ThemeOverrides;
  settings: AppSettings;
  catalog: Catalog;
};

export type BannerAction = TapAction;

export type Banner = {
  _id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  imageUrl: string | null;
  placement: BannerPlacement;
  layout: BannerLayout;
  action: BannerAction;
  backgroundColor: string | null;
  textColor: string | null;
  priority: number;
  active: boolean;
  dismissible: boolean;
  audience: Audience;
  startAt: string | null;
  endAt: string | null;
  clickCount: number;
  impressionCount: number;
  status: BannerStatus;
  updatedAt: string;
  updatedBy?: StaffRef;
};

export type BannerInput = Omit<Banner, "_id" | "clickCount" | "impressionCount" | "status" | "updatedAt" | "updatedBy">;

export type StaffUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  access?: { roleLabel?: string; permissions: string[] };
};

/* ------------------------------ HTTP plumbing ----------------------------- */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;
export const onUnauthorized = (fn: () => void) => {
  unauthorizedHandler = fn;
};

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session just won't survive a reload */
  }
};

export const isApiConfigured = () => Boolean(API_BASE);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new ApiError("VITE_API_BASE_URL is not set — see .env.example", 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    throw new ApiError(
      (err as Error).name === "AbortError"
        ? "The server took too long to answer. Try again."
        : "Can't reach the server. Check your connection.",
      0
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) unauthorizedHandler?.();
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

type Envelope<T> = { data: T; message?: string; token?: string };

const get = async <T>(path: string) => (await request<Envelope<T>>(path)).data;
const send = async <T>(method: string, path: string, body?: unknown) =>
  (
    await request<Envelope<T>>(path, {
      method,
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body)
    })
  ).data;

/* ---------------------------------- Auth --------------------------------- */

export async function login(email: string, password: string): Promise<StaffUser> {
  const res = await request<Envelope<StaffUser>>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  const token = res.token ?? (res.data as unknown as { token?: string })?.token;
  if (!token) throw new ApiError("Sign-in didn't return a session. Try again.", 500);
  setToken(token);
  return res.data;
}

export const getMe = () => get<{ user: StaffUser; access: StaffUser["access"] }>("/api/admin/me");

/* ----------------------------------- CMS ---------------------------------- */

type SavedConfig = Omit<CmsConfig, "catalog">;

export const getConfig = () => get<CmsConfig>("/api/cms/config");

export const saveFeatures = (version: number, features: Feature[], customTiles: CustomTile[]) =>
  send<SavedConfig>("PUT", "/api/cms/features", {
    version,
    customTiles,
    features: features.map(({ key, enabled, placement, size, colorKey, order, title, description, badge, audience, defaults }) => ({
      key,
      enabled,
      placement,
      size,
      colorKey,
      order,
      // Text equal to the app's default is saved as "no override", so a later
      // change to the default in the app still reaches this tile.
      title: title.trim() === defaults.title ? null : title.trim() || null,
      description: description.trim() === defaults.description ? null : description.trim() || null,
      badge: badge?.trim() || null,
      audience
    }))
  });

export const saveSettings = (version: number, settings: AppSettings) =>
  send<SavedConfig>("PUT", "/api/cms/settings", { version, settings });

export const listRevisions = (section?: ConfigSection) =>
  get<{ revisions: Revision[] }>(`/api/cms/revisions${section ? `?section=${section}` : ""}`);

export const restoreRevision = (id: string) => send<SavedConfig>("POST", `/api/cms/revisions/${id}/restore`);

export const saveHomeSections = (version: number, homeSections: HomeSection[]) =>
  send<SavedConfig>("PUT", "/api/cms/home", {
    version,
    homeSections: homeSections.map(({ key, visible }, order) => ({ key, visible, order }))
  });

export const saveTheme = (version: number, theme: ThemeOverrides) =>
  send<SavedConfig>("PUT", "/api/cms/theme", { version, theme });

export const listBanners = () => get<{ banners: Banner[] }>("/api/cms/banners");
export const createBanner = (input: BannerInput) => send<{ banner: Banner }>("POST", "/api/cms/banners", input);
export const updateBanner = (id: string, input: BannerInput) =>
  send<{ banner: Banner }>("PUT", `/api/cms/banners/${id}`, input);
export const deleteBanner = (id: string) => send<{ id: string }>("DELETE", `/api/cms/banners/${id}`);

/* ---------------------- Phase Era cycle-syncing tips ---------------------- */

export type CyclePhase = "period" | "follicular" | "ovulation" | "luteal";
export type TipCategory = "move" | "fuel" | "selfCare" | "vibe";

export type CycleSyncTip = {
  /** Missing on the built-in defaults (not saved yet). */
  _id?: string;
  phase: CyclePhase;
  category: TipCategory;
  emoji: string;
  title: string;
  body: string;
  active: boolean;
  order: number;
  updatedAt?: string;
};
export type TipInput = Omit<CycleSyncTip, "_id" | "updatedAt">;

export type PhaseEra = { name: string; emoji: string; tagline: string; aura: [string, string]; statusEmoji: string };

export type TipsResponse = {
  tips: CycleSyncTip[];
  usingDefaults: boolean;
  phases: CyclePhase[];
  categories: TipCategory[];
  categoryLabels: Record<TipCategory, string>;
  eras: Record<CyclePhase, PhaseEra>;
};

export const listTips = () => get<TipsResponse>("/api/cms/cycle-sync-tips");
export const seedTips = () => send<{ tips: CycleSyncTip[] }>("POST", "/api/cms/cycle-sync-tips/seed");
export const createTip = (input: TipInput) => send<{ tip: CycleSyncTip }>("POST", "/api/cms/cycle-sync-tips", input);
export const updateTip = (id: string, input: TipInput) =>
  send<{ tip: CycleSyncTip }>("PUT", `/api/cms/cycle-sync-tips/${id}`, input);
export const deleteTip = (id: string) => send<{ id: string }>("DELETE", `/api/cms/cycle-sync-tips/${id}`);

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url } = await send<{ url: string }>("POST", "/api/cms/upload", form);
  return url;
}

export const errorMessage = (err: unknown, fallback = "Something went wrong.") =>
  err instanceof Error ? err.message : fallback;
