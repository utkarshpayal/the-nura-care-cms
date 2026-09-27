// Launch states (docs/launch-states.md): labels, validation, recipes and the
// warnings shared by Screens & features, Launches, Overview and Banners.
import { CustomTile, DEFAULT_LAUNCH, EVERYONE, Feature, Launch, LaunchHeadline, LaunchState } from "./api";
import { actionError, audienceError } from "../components/editors";

export const LAUNCH_STATES: { value: LaunchState; label: string }[] = [
  { value: "coming_soon", label: "Coming soon" },
  { value: "rolling_out", label: "Rolling out" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" }
];

export const LAUNCH_STATE_LABEL: Record<LaunchState, string> = {
  coming_soon: "Coming soon",
  rolling_out: "Rolling out",
  live: "Live",
  paused: "Paused"
};

export const HEADLINE_LABEL: Record<LaunchHeadline, string> = {
  soon: "Coming soon",
  this_month: "Coming this month",
  next_month: "Coming next month",
  custom: "Custom…"
};

export const ROLLOUT_STEPS = [5, 10, 25, 50, 100];

export const DEFAULT_PAUSED_TITLE = "Taking a short break";
export const DEFAULT_PAUSED_MESSAGE = "We're working on it. Please check back soon.";

/** The line the app shows at the top of the Coming soon sheet. */
export const headlineText = (l: Launch) =>
  l.soon.headline === "custom" ? l.soon.customHeadline?.trim() || "Coming soon" : HEADLINE_LABEL[l.soon.headline];

/** The row pill: null while plainly live. */
export const launchPill = (l: Launch): { text: string; cls: string } | null => {
  switch (l.state) {
    case "coming_soon":
      return { text: "SOON", cls: "pill-soon" };
    case "rolling_out":
      return { text: `ROLLOUT ${l.rollout.percent}%`, cls: "pill-rollout" };
    case "paused":
      return { text: "PAUSED", cls: "pill-paused" };
    default:
      return null;
  }
};

/** Open to everyone in the item's audience, right now. */
export const isFullyLive = (l: Launch) => l.state === "live" || (l.state === "rolling_out" && l.rollout.percent >= 100 && isEveryone(l.rollout.audience));

const isEveryone = (a: Launch["rollout"]["audience"]) =>
  a.segment === "all" && a.platforms.length === 0 && !a.minAppVersion && !a.maxAppVersion;

/** Move to `state`, remembering where Pause came from and dropping schedules that no longer apply. */
export const withState = (l: Launch, state: LaunchState): Launch => {
  if (state === l.state) return l;
  const next: Launch = { ...l, state };
  if (state === "paused") next.resumeTo = l.state === "rolling_out" ? "rolling_out" : "live";
  if (state === "live" || state === "paused") next.soon = { ...l.soon, goLiveAt: null };
  if (state !== "paused") next.paused = { ...l.paused, resumeAt: null };
  return next;
};

/** What Resume does for a paused item. */
export const resumed = (l: Launch) => withState(l, l.resumeTo);

/* -------------------------------- Testers -------------------------------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s-]{6,17}$/;
export const isTesterInput = (v: string) => EMAIL.test(v) || PHONE.test(v) || /^[0-9a-f]{24}$/i.test(v);
export const MAX_TESTERS = 50;

/* ------------------------------ Dates (local) ----------------------------- */

/** ISO → the value of an <input type="datetime-local"> in the staff member's timezone. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/* ------------------------------- Validation ------------------------------- */

const inPast = (iso: string | null) => Boolean(iso) && new Date(iso!).getTime() <= Date.now();

/**
 * The first problem that blocks saving, or null. A date that was already
 * saved isn't re-checked (the scheduler may be a minute behind), only a new one.
 */
export const launchError = (l: Launch, saved?: Launch) => {
  const teased = l.state === "coming_soon" || (l.state === "rolling_out" && l.rollout.othersSee === "coming_soon");
  if (teased && l.soon.headline === "custom" && !l.soon.customHeadline?.trim()) return "Write the custom headline, or pick another one";
  if (!Number.isInteger(l.rollout.percent) || l.rollout.percent < 0 || l.rollout.percent > 100) return "The rollout must be 0–100%";
  if (l.state === "rolling_out") {
    const e = audienceError(l.rollout.audience);
    if (e) return `Rollout: ${e}`;
  }
  if (l.state === "paused") {
    const e = actionError(l.paused.alternative);
    if (e) return `Paused: ${e}`;
  }
  if ((l.state === "coming_soon" || l.state === "rolling_out") && l.soon.goLiveAt !== saved?.soon.goLiveAt && inPast(l.soon.goLiveAt)) {
    return "The go-live time is in the past";
  }
  if (l.state === "paused" && l.paused.resumeAt !== saved?.paused.resumeAt && inPast(l.paused.resumeAt)) return "The resume time is in the past";
  if (l.testers.length > MAX_TESTERS) return `At most ${MAX_TESTERS} testers`;
  const bad = l.testers.find((t) => !t.id && !isTesterInput(t.label.trim()));
  if (bad) return `“${bad.label}” isn't an email or phone number`;
  return null;
};

/**
 * A sentence to confirm before publishing, when the change takes the feature
 * away from people or opens it to everyone. Null when nothing needs confirming.
 */
export const launchConfirm = (title: string, saved: Launch, next: Launch): string | null => {
  const wasOpen = saved.state === "live" || saved.state === "rolling_out";
  if (next.state === "live" && saved.state !== "live") return `Launch “${title}” to everyone in its audience?`;
  if (next.state === "coming_soon" && wasOpen) return `“${title}” goes back to Coming soon. People who use it now will lose access.`;
  if (next.state === "rolling_out" && saved.state === "live") return `“${title}” goes from Live to a ${next.rollout.percent}% rollout. People outside it will lose access.`;
  if (next.state === "rolling_out" && saved.state === "rolling_out" && next.rollout.percent < saved.rollout.percent) {
    return `Lower “${title}” from ${saved.rollout.percent}% to ${next.rollout.percent}%? Some people who have it now will lose access.`;
  }
  return null;
};

/* --------------------------------- Recipes -------------------------------- */

export const RECIPES: { id: string; label: string; apply: (l: Launch) => Launch }[] = [
  { id: "tease", label: "Tease it", apply: (l) => ({ ...withState(l, "coming_soon"), soon: { ...l.soon, notifyMe: true } }) },
  { id: "staff", label: "Staff test", apply: (l) => ({ ...withState(l, "coming_soon"), soon: { ...l.soon, notifyMe: false } }) },
  {
    id: "android",
    label: "Android first",
    apply: (l) => ({
      ...withState(l, "rolling_out"),
      rollout: { percent: 100, audience: { ...EVERYONE, platforms: ["android"] }, othersSee: "coming_soon", betaLabel: false }
    })
  },
  {
    id: "premium",
    label: "Premium early access",
    apply: (l) => ({
      ...withState(l, "rolling_out"),
      rollout: { percent: 100, audience: { ...EVERYONE, segment: "premium" }, othersSee: "coming_soon", betaLabel: true }
    })
  },
  { id: "pause", label: "Pause it", apply: (l) => ({ ...withState(l, "paused"), paused: { ...DEFAULT_LAUNCH.paused, alternative: l.paused.alternative } }) }
];

/* ---------------------------------- Routes -------------------------------- */

/** "/(app)/qa?new=1" → "/qa": the path the app's route guard matches on. */
export const routePath = (route: string) => route.replace(/^\/\((?:app|tabs)\)/, "").split("?")[0].replace(/\/+$/, "") || "/";

/** The built-in feature a route opens, if any (same rule as the app's route guard). */
export const featureForRoute = (features: Feature[], route: string | null | undefined) => {
  if (!route) return undefined;
  const p = routePath(route);
  return features.find((f) => {
    const fp = routePath(f.route);
    return p === fp || p.startsWith(`${fp}/`);
  });
};

/** Items (feature or link tile) with their stats key, for lists across both kinds. */
export type LaunchItem = {
  itemKey: string;
  /** The id Screens & features uses for the row (to open it via ?open=). */
  rowId: string | null;
  kind: "feature" | "link";
  title: string;
  placement: Feature["placement"];
  enabled: boolean;
  route: string | null;
  launch: Launch;
};

export const launchItems = (features: Feature[], tiles: CustomTile[]): LaunchItem[] => [
  ...features.map((f) => ({ itemKey: f.key, rowId: f.key, kind: "feature" as const, title: f.title, placement: f.placement, enabled: f.enabled, route: f.route, launch: f.launch })),
  ...tiles.map((t) => ({
    itemKey: `link:${t.id}`,
    rowId: t.id ? `link:${t.id}` : null,
    kind: "link" as const,
    title: t.title,
    placement: t.placement,
    enabled: t.enabled,
    route: null,
    launch: t.launch
  }))
];
