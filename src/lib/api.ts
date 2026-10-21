// Backend client for the CMS. Everything goes to period-buddy-be:
//   /api/auth/login   staff sign-in (same accounts as the Admin Workspace)
//   /api/admin/me     refresh the signed-in staff member's permissions
//   /api/cms/*        read/write the app config (cms.read / cms.manage)

// Same backends and toggle as the mobile app (its app.json extra.apiBaseUrls).
// VITE_API_BASE_URL, if set, wins; else VITE_APP_ENV picks one (vite.config.ts
// defaults it from VERCEL_ENV: production → prod, preview → stage).
const API_BASE_URLS = {
  prod: "https://www.backend.thenura.care",
  stage: "https://stage.backend.thenura.care"
} as const;
type AppEnv = keyof typeof API_BASE_URLS;
const APP_ENV = import.meta.env.VITE_APP_ENV as string | undefined;
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (APP_ENV && APP_ENV in API_BASE_URLS ? API_BASE_URLS[APP_ENV as AppEnv] : "")
).replace(/\/$/, "");
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

/* ------------------------------ Launch states ----------------------------- */
// See docs/launch-states.md §7.1. Every feature and link tile has one.

export type LaunchState = "live" | "coming_soon" | "rolling_out" | "paused";
export type LaunchHeadline = "soon" | "this_month" | "next_month" | "custom";
/** A tester as typed in the CMS: `id` is null until the server resolves the email/phone on save. */
export type Tester = { id: string | null; label: string };

export type Launch = {
  state: LaunchState;
  /** While paused: what Resume goes back to. */
  resumeTo: "live" | "rolling_out";
  rollout: { percent: number; audience: Audience; othersSee: "coming_soon" | "hidden"; betaLabel: boolean };
  soon: { headline: LaunchHeadline; customHeadline: string | null; message: string | null; notifyMe: boolean; goLiveAt: string | null };
  paused: { title: string | null; message: string | null; alternative: TapAction; alternativeLabel: string | null; resumeAt: string | null };
  testers: Tester[];
  /** Server-set: when `state` last changed. */
  since: string | null;
};

export const DEFAULT_LAUNCH: Launch = {
  state: "live",
  resumeTo: "live",
  rollout: { percent: 10, audience: EVERYONE, othersSee: "coming_soon", betaLabel: false },
  soon: { headline: "soon", customHeadline: null, message: null, notifyMe: true, goLiveAt: null },
  paused: { title: null, message: null, alternative: { type: "none", value: null, fallbackUrl: null }, alternativeLabel: null, resumeAt: null },
  testers: [],
  since: null
};

/** Fill anything missing (e.g. a backend without launch states yet) from the defaults. */
export const normalizeLaunch = (raw?: Partial<Launch> | null): Launch => {
  const l = raw ?? {};
  return {
    ...DEFAULT_LAUNCH,
    ...l,
    rollout: { ...DEFAULT_LAUNCH.rollout, ...(l.rollout ?? {}), audience: { ...EVERYONE, ...(l.rollout?.audience ?? {}) } },
    soon: { ...DEFAULT_LAUNCH.soon, ...(l.soon ?? {}) },
    paused: { ...DEFAULT_LAUNCH.paused, ...(l.paused ?? {}), alternative: { ...DEFAULT_LAUNCH.paused.alternative, ...(l.paused?.alternative ?? {}) } },
    testers: (l.testers ?? []).map((t) => ({ id: t.id ?? null, label: t.label ?? t.id ?? "" })),
    since: l.since ?? null
  };
};

/** What PUT /api/cms/features takes: testers as strings (resolved id, or the typed email/phone), no `since`. */
const launchPayload = ({ since: _s, testers, soon, paused, ...l }: Launch) => ({
  ...l,
  soon: { ...soon, customHeadline: soon.customHeadline?.trim() || null, message: soon.message?.trim() || null },
  paused: {
    ...paused,
    title: paused.title?.trim() || null,
    message: paused.message?.trim() || null,
    alternative: paused.alternative.type === "none" ? { type: "none", value: null, fallbackUrl: null } : paused.alternative,
    alternativeLabel: paused.alternative.type === "none" ? null : paused.alternativeLabel?.trim() || null
  },
  testers: testers.map((t) => t.id ?? t.label.trim())
});

/** Stats key: the feature key, or `link:<id>` for a link tile. */
export type LaunchStats = Record<
  string,
  {
    waiting: number;
    /** Sign-ups with an account that haven't had the "It's here" push yet. */
    toNotify: number;
    /** Signed-out sign-ups: a push can't reach them. */
    deviceOnly: number;
    lastNotifiedAt: string | null;
    lockedTaps: number;
  }
>;

export type WaitlistEntry = {
  createdAt: string;
  platform: AudiencePlatform | null;
  user: { _id: string; firstName?: string; lastName?: string; email?: string; phone?: string } | null;
};

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
  launch: Launch;
};

export type ConfigSection = "features" | "homeSections" | "screenSections" | "theme" | "settings";

export type AppSettings = {
  maintenance: { enabled: boolean; title: string; message: string };
  update: {
    minVersion: string | null;
    latestVersion: string | null;
    title: string;
    message: string;
    androidUrl: string | null;
    iosUrl: string | null;
    /** "What's new" points under the message: ≤ UPDATE_HIGHLIGHTS_MAX, each ≤ UPDATE_HIGHLIGHT_MAX_LENGTH; blanks are dropped on save. */
    highlights: string[];
    /** The primary button (≤24). */
    ctaLabel: string;
    /** false hides "Later" for people below latestVersion. */
    dismissible: boolean;
    /** true shows the prompt to every store-app user, whatever version. Needs a store link. */
    forceShowAll: boolean;
    /** The prompt shows once per id (≤40 of A-Z a-z 0-9 . _ -); null = once per latestVersion. */
    promptId: string | null;
  };
};

/** Backend limits for the update prompt (period-buddy-be constants/appCatalog.js, utils/appConfig.js parseSettings). */
export const UPDATE_HIGHLIGHTS_MAX = 5;
export const UPDATE_HIGHLIGHT_MAX_LENGTH = 80;
export const UPDATE_CTA_MAX_LENGTH = 24;
export const UPDATE_PROMPT_ID = /^[A-Za-z0-9._-]{1,40}$/;

/** The update-prompt fields added after launch, with the backend's defaults (DEFAULT_SETTINGS.update). */
const UPDATE_PROMPT_DEFAULTS = { highlights: [] as string[], ctaLabel: "Update now", dismissible: true, forceShowAll: false, promptId: null as string | null };

/** Settings with any field an older API omits filled in, so editors always have a value. */
export const withSettingsDefaults = (s: AppSettings): AppSettings => ({
  ...s,
  update: { ...UPDATE_PROMPT_DEFAULTS, ...s.update, highlights: s.update?.highlights ?? [] }
});

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
  launch: Launch;
  defaults: { title: string; description: string; placement: FeaturePlacement; size: FeatureSize; colorKey: string };
};

/**
 * A block on Home or another screen. `text` overrides its heading or intro
 * (null = the app's `textDefault`; only blocks with a `textLabel` have one);
 * `audience` and `startAt` / `endAt` narrow who sees it and when.
 */
export type HomeSection = {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  text: string | null;
  textLabel?: string;
  textDefault?: string;
  textMax?: number;
  audience: Audience;
  startAt: string | null;
  endAt: string | null;
};

/** Screens other than Home whose blocks can be reordered or hidden. */
export type LayoutScreen = "profile" | "care_hub" | "wellness_hub" | "explore_hub";
export const LAYOUT_SCREENS: LayoutScreen[] = ["profile", "care_hub", "wellness_hub", "explore_hub"];
/** `required` blocks can be moved but not hidden. */
export type ScreenSection = HomeSection & { required?: boolean };

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
  /** Missing from a backend that predates screen layouts. */
  screenSections?: Record<LayoutScreen, ScreenSection[]>;
  /** Hub title overrides (null = the app's `default`). */
  screenTitles?: Partial<Record<LayoutScreen, { title: string | null; default: string }>>;
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

// Cookie sessions (backend utils/sessionCookie.js): the token lives in an
// httpOnly cookie this page can't read, and this marker takes its place in
// localStorage so "signed in?" checks keep working.
const COOKIE_SESSION = "cookie-session";
const isCookieSession = (token: string) => token === COOKIE_SESSION;

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

/** Which backend this build talks to, for the environment pill; null on prod. */
export const backendLabel = (): string | null => {
  if (!API_BASE || API_BASE === API_BASE_URLS.prod) return null;
  if (API_BASE === API_BASE_URLS.stage) return "Staging";
  return /\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:|\/|$)/.test(API_BASE) ? "Local" : "Custom backend";
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new ApiError("No backend set: VITE_APP_ENV or VITE_API_BASE_URL — see .env.example", 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !isCookieSession(token)) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal: controller.signal
    });
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

/** Staff confirm sign-in with an emailed code (backend STAFF_2FA_ENABLED). */
export type LoginChallenge = {
  challengeToken: string;
  /** "totp": the code comes from their authenticator app (or a recovery code). */
  method?: "email" | "totp";
  sentTo?: string;
  expiresInMinutes?: number;
};

export class SecondStepRequired extends Error {
  constructor(public challenge: LoginChallenge, message: string) {
    super(message);
  }
}

// Ask for the session in an httpOnly cookie (only honoured when the backend
// has STAFF_COOKIE_AUTH on; otherwise the token comes back as before).
const authPost = (path: string, body: unknown) =>
  request<Envelope<StaffUser>>(path, {
    method: "POST",
    headers: { "X-Session-Mode": "cookie" },
    body: JSON.stringify(body)
  });

/**
 * The backend set the session cookie. Check the browser really sends it back
 * (it won't when the CMS runs on another domain, e.g. a preview deploy)
 * before dropping the token.
 */
const cookieWorks = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
};

const startSession = async (res: Envelope<StaffUser>): Promise<StaffUser> => {
  const token = res.token ?? (res.data as unknown as { token?: string })?.token;
  if (!token) throw new ApiError("Sign-in didn't return a session. Try again.", 500);
  const cookie = (res.data as { sessionMode?: string })?.sessionMode === "cookie" && (await cookieWorks());
  setToken(cookie ? COOKIE_SESSION : token);
  return res.data;
};

export async function login(email: string, password: string): Promise<StaffUser> {
  setToken(null);
  const res = await authPost("/api/auth/login", { email, password });
  const challenge = res.data as unknown as LoginChallenge & { twoFactorRequired?: boolean };
  if (challenge?.twoFactorRequired && challenge.challengeToken) {
    throw new SecondStepRequired(challenge, res.message ?? "Enter the code we emailed you.");
  }
  return startSession(res);
}

export async function verifyLoginCode(challengeToken: string, code: string): Promise<StaffUser> {
  return startSession(await authPost("/api/auth/login/verify-code", { challengeToken, code }));
}

export async function resendLoginCode(challengeToken: string): Promise<string> {
  const res = await authPost("/api/auth/login/resend-code", { challengeToken });
  return res.message ?? "We sent you a new code.";
}

/**
 * End this browser's session on the server, so the token stops working now
 * rather than when it expires (12 hours for staff). Fire and forget.
 */
export const revokeSession = () => {
  const token = getToken();
  if (!token || !API_BASE) return;
  fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    headers: {
      ...(isCookieSession(token) ? {} : { Authorization: `Bearer ${token}` }),
      "Content-Type": "application/json"
    },
    body: "{}",
    credentials: "include",
    keepalive: true
  }).catch(() => undefined);
};

export const getMe = () => get<{ user: StaffUser; access: StaffUser["access"] }>("/api/admin/me");

/* ----------------------------------- CMS ---------------------------------- */

type SavedConfig = Omit<CmsConfig, "catalog">;

/** Give every feature and link tile a complete `launch`, whatever the server sent. */
export const withLaunches = <T extends Partial<SavedConfig>>(c: T): T => ({
  ...c,
  ...(c.features && { features: c.features.map((f) => ({ ...f, launch: normalizeLaunch(f.launch) })) }),
  ...(c.customTiles && { customTiles: c.customTiles.map((t) => ({ ...t, launch: normalizeLaunch(t.launch) })) })
});

export const getConfig = async () => withLaunches(await get<CmsConfig>("/api/cms/config"));

export const saveFeatures = (version: number, features: Feature[], customTiles: CustomTile[]) =>
  send<SavedConfig>("PUT", "/api/cms/features", {
    version,
    customTiles: customTiles.map((t) => ({ ...t, launch: launchPayload(t.launch) })),
    features: features.map(({ key, enabled, placement, size, colorKey, order, title, description, badge, audience, launch, defaults }) => ({
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
      audience,
      launch: launchPayload(launch)
    }))
  });

export const getLaunchStats = () => get<{ stats: LaunchStats }>("/api/cms/launches");
/** Push "It's here" to a launched item's waitlist (people with an account, not told yet). */
export const announceLaunch = (itemKey: string, message: { title: string; body: string }) =>
  send<{ broadcastId: string; recipients: number; withPush: number; remaining: number }>(
    "POST",
    `/api/cms/launches/${encodeURIComponent(itemKey)}/announce`,
    message
  );
export const getWaitlist = (itemKey: string) =>
  get<{ entries: WaitlistEntry[] }>(`/api/cms/launches/${encodeURIComponent(itemKey)}/waitlist`);

export const saveSettings = (version: number, settings: AppSettings) =>
  send<SavedConfig>("PUT", "/api/cms/settings", { version, settings });

export const listRevisions = (section?: ConfigSection) =>
  get<{ revisions: Revision[] }>(`/api/cms/revisions${section ? `?section=${section}` : ""}`);

export const restoreRevision = (id: string) => send<SavedConfig>("POST", `/api/cms/revisions/${id}/restore`);

/** What the API takes for a block: its place in the list is its order. */
const sectionPayload = ({ key, visible, text, audience, startAt, endAt }: HomeSection, order: number) => ({
  key,
  visible,
  order,
  text: text?.trim() || null,
  audience,
  startAt,
  endAt
});

export const saveHomeSections = (version: number, homeSections: HomeSection[]) =>
  send<SavedConfig>("PUT", "/api/cms/home", { version, homeSections: homeSections.map(sectionPayload) });

/** One screen's blocks; `version` is `sectionVersions.screenSections`. */
export const saveScreenSections = (version: number, screen: LayoutScreen, sections: ScreenSection[], title?: string | null) =>
  send<SavedConfig>("PUT", `/api/cms/screens/${screen}`, {
    version,
    sections: sections.map(sectionPayload),
    ...(title !== undefined && { title: title?.trim() || null })
  });

/* ---------------------------------- Usage --------------------------------- */

export type UsageRange = 7 | 30 | 90;
/** Per item key (feature key or `link:<id>`); `daily` lines up with `days`. */
export type UsageItem = { opens: number; taps: number; devices: number; daily: { opens: number; taps: number }[] };
export type UsageReport = { days: string[]; items: Record<string, UsageItem> };

export const getUsage = (days: UsageRange) => get<UsageReport>(`/api/cms/usage?days=${days}`);

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
  /** The built-in era cards, for "Reset to default". */
  eraDefaults: Record<CyclePhase, PhaseEra>;
  /** Phases whose era card has been edited in the CMS. */
  customisedEras: CyclePhase[];
};

export type EraInput = { name: string; emoji: string; tagline: string; aura: [string, string] };

export const listTips = () => get<TipsResponse>("/api/cms/cycle-sync-tips");
export const seedTips = () => send<{ tips: CycleSyncTip[] }>("POST", "/api/cms/cycle-sync-tips/seed");
export const createTip = (input: TipInput) => send<{ tip: CycleSyncTip }>("POST", "/api/cms/cycle-sync-tips", input);
export const updateTip = (id: string, input: TipInput) =>
  send<{ tip: CycleSyncTip }>("PUT", `/api/cms/cycle-sync-tips/${id}`, input);
export const deleteTip = (id: string) => send<{ id: string }>("DELETE", `/api/cms/cycle-sync-tips/${id}`);
export const updateEra = (phase: CyclePhase, input: EraInput) =>
  send<{ eras: Record<CyclePhase, PhaseEra> }>("PUT", `/api/cms/cycle-sync-eras/${phase}`, input);
export const resetEra = (phase: CyclePhase) =>
  send<{ eras: Record<CyclePhase, PhaseEra> }>("DELETE", `/api/cms/cycle-sync-eras/${phase}`);

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url } = await send<{ url: string }>("POST", "/api/cms/upload", form);
  return url;
}

export const errorMessage = (err: unknown, fallback = "Something went wrong.") =>
  err instanceof Error ? err.message : fallback;
