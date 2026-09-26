import type { ActionType, AudienceSegment, BannerPlacement, FeaturePlacement, ThemeMode, ThemeOverrides, ThemeToken } from "./api";

export const PLACEMENT_LABEL: Record<FeaturePlacement, string> = {
  care_hub: "Care & Insights",
  wellness_hub: "Wellness & Support",
  explore_hub: "Explore",
  home: "Home — Shortcuts",
  profile: "Profile — Shortcuts"
};

/** Where each placement lives in the app, for the column hint. */
export const PLACEMENT_HINT: Record<FeaturePlacement, string> = {
  care_hub: "Hub screen, opened from Home › More for you",
  wellness_hub: "Hub screen, opened from Home › More for you",
  explore_hub: "Hub screen, opened from Home › More for you",
  home: "A Shortcuts block right on the Home screen",
  profile: "A Shortcuts block on the Profile tab"
};

export const SEGMENT_LABEL: Record<AudienceSegment, string> = {
  all: "Everyone",
  signed_in: "Signed-in users",
  premium: "Premium subscribers",
  free: "Free (signed-in, no plan)"
};

export const ACTION_LABEL: Record<ActionType, string> = {
  none: "Nothing (info only)",
  route: "Open a screen in the app",
  url: "Open a website (in-app browser)",
  app: "Open another app"
};

/** Common "open another app" links, prefilled with a fallback. */
export const APP_LINK_PRESETS: { label: string; value: string; fallbackUrl: string }[] = [
  { label: "WhatsApp chat", value: "whatsapp://send?phone=91XXXXXXXXXX", fallbackUrl: "https://wa.me/91XXXXXXXXXX" },
  { label: "YouTube channel", value: "youtube://www.youtube.com/@thenura", fallbackUrl: "https://www.youtube.com/@thenura" },
  { label: "Instagram profile", value: "instagram://user?username=thenura", fallbackUrl: "https://www.instagram.com/thenura" },
  { label: "Phone call", value: "tel:+91XXXXXXXXXX", fallbackUrl: "" },
  { label: "Email", value: "mailto:hello@thenura.care", fallbackUrl: "" },
  { label: "Play Store app", value: "market://details?id=com.example.app", fallbackUrl: "https://play.google.com/store/apps/details?id=com.example.app" }
];

export const BANNER_PLACEMENT_LABEL: Record<BannerPlacement, string> = {
  home_top: "Home — top slot",
  home_middle: "Home — middle slot",
  popup: "Pop-up on opening Home (once)",
  care_hub: "Care & Insights hub",
  wellness_hub: "Wellness & Support hub",
  explore_hub: "Explore hub",
  profile: "Profile tab"
};

export const COLOR_LABEL: Record<string, string> = {
  primary: "Rose (primary)",
  secondary: "Lavender (secondary)",
  accent: "Mint (accent)",
  info: "Violet",
  warning: "Amber",
  success: "Green",
  gold: "Gold",
  sky: "Sky",
  rose: "Rose",
  lavender: "Lavender",
  mint: "Mint"
};

/**
 * The app's full built-in palette (period-buddy components/theme.tsx), for
 * previews. The CMS can override only the tokens the backend lists in
 * catalog.themeTokens; the rest here (info, warning, gold…) are fixed and
 * used by feature tiles' colour keys.
 */
export const APP_PALETTE: Record<ThemeMode, Record<string, string>> = {
  light: {
    background: "#F6EEF1", surface: "#FFFFFF", surfaceSoft: "#FCF5F7", surfaceStrong: "#F3DEE6",
    primary: "#E8618F", primaryDark: "#C94A78", primaryLight: "#F7CADA",
    secondary: "#B9A6E0", secondaryLight: "#EEE6FA", accent: "#9FD8C9", accentLight: "#DDF0E2",
    foreground: "#3A2A32", border: "#E3C6D2", button: "#E8618F", buttonText: "#FFFFFF",
    text: "#3A2A32", mutedText: "#6E5A63",
    success: "#3E8A5A", successLight: "#DDF0E2", warning: "#B4711F", warningLight: "#FCE3C4",
    info: "#6B5CA5", infoLight: "#EEE6FA", rose: "#E8618F", roseLight: "#F7CADA",
    lavender: "#B9A6E0", lavenderLight: "#EEE6FA", mint: "#9FD8C9", mintLight: "#DDF0E2",
    sky: "#5B8FCE", skyLight: "#E1EBFA", gold: "#C99A2E", goldLight: "#FBF0D4"
  },
  dark: {
    background: "#221A20", surface: "#2E2530", surfaceSoft: "#3A2C34", surfaceStrong: "#4A2E3A",
    primary: "#F28FB0", primaryDark: "#E8618F", primaryLight: "rgba(242, 143, 176, 0.18)",
    secondary: "#C7B8E8", secondaryLight: "rgba(199, 184, 232, 0.14)",
    accent: "#8FCDBB", accentLight: "rgba(143, 205, 187, 0.14)",
    foreground: "#F3E8ED", border: "#3D2E36", button: "#F28FB0", buttonText: "#221A20",
    text: "#F3E8ED", mutedText: "#B39AA6",
    success: "#8FD1A8", successLight: "rgba(143, 209, 168, 0.16)",
    warning: "#F0C377", warningLight: "rgba(240, 195, 119, 0.14)",
    info: "#C7B8E8", infoLight: "rgba(199, 184, 232, 0.16)",
    rose: "#F28FB0", roseLight: "rgba(242, 143, 176, 0.16)",
    lavender: "#C7B8E8", lavenderLight: "rgba(199, 184, 232, 0.16)",
    mint: "#8FCDBB", mintLight: "rgba(143, 205, 187, 0.16)",
    sky: "#8FB3E0", skyLight: "rgba(143, 179, 224, 0.16)",
    gold: "#E0BE6F", goldLight: "rgba(224, 190, 111, 0.18)"
  }
};

/** The app's palette for a mode with the CMS overrides applied. */
export const resolvePalette = (mode: ThemeMode, theme: ThemeOverrides) => ({
  ...APP_PALETTE[mode],
  ...(theme[mode] ?? {})
});

export type ThemePreset = { id: string; name: string; theme: ThemeOverrides };

/** Starting points; each only sets a few tokens, the rest stay the app's defaults. */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "nura", name: "Nura Rose (app default)", theme: { light: {}, dark: {} } },
  {
    id: "lavender",
    name: "Lavender Dream",
    theme: {
      light: { primary: "#7C5CC4", primaryDark: "#5F43A3", primaryLight: "#E6DDF7", button: "#7C5CC4", background: "#F3F0FA", surfaceSoft: "#F8F6FD", border: "#D9D0EE" },
      dark: { primary: "#B9A3F0", primaryDark: "#9A80E0", primaryLight: "rgba(185, 163, 240, 0.18)", button: "#B9A3F0", background: "#1C1826", surface: "#27213A", surfaceSoft: "#312A47", border: "#3A3252" }
    }
  },
  {
    id: "ocean",
    name: "Ocean Calm",
    theme: {
      light: { primary: "#2D7FB8", primaryDark: "#1F6394", primaryLight: "#D3E7F5", button: "#2D7FB8", background: "#EEF4F8", surfaceSoft: "#F5F9FC", border: "#C9DCEA", accent: "#7FCBC4" },
      dark: { primary: "#7DB8E3", primaryDark: "#5A9FD2", primaryLight: "rgba(125, 184, 227, 0.18)", button: "#7DB8E3", background: "#16202A", surface: "#1F2C38", surfaceSoft: "#283847", border: "#2F4152" }
    }
  },
  {
    id: "mint",
    name: "Fresh Mint",
    theme: {
      light: { primary: "#2E9C7E", primaryDark: "#227A62", primaryLight: "#CFEDE3", button: "#2E9C7E", background: "#EEF7F3", surfaceSoft: "#F5FBF8", border: "#C5E3D7", secondary: "#E89BB5" },
      dark: { primary: "#7FD3B8", primaryDark: "#5DBF9F", primaryLight: "rgba(127, 211, 184, 0.18)", button: "#7FD3B8", background: "#15211D", surface: "#1E2E28", surfaceSoft: "#273A33", border: "#2E443B" }
    }
  },
  {
    id: "sunset",
    name: "Warm Sunset",
    theme: {
      light: { primary: "#E0703A", primaryDark: "#BF5626", primaryLight: "#F9D9C6", button: "#E0703A", background: "#FBF2EC", surfaceSoft: "#FDF7F3", border: "#EFD3C1", secondary: "#E3A1B8" },
      dark: { primary: "#F2A27A", primaryDark: "#E8845A", primaryLight: "rgba(242, 162, 122, 0.18)", button: "#F2A27A", background: "#241A16", surface: "#302420", surfaceSoft: "#3B2D27", border: "#46352D" }
    }
  }
];

/** Group theme tokens into editor sections. */
export const TOKEN_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Brand", keys: ["primary", "primaryDark", "primaryLight", "secondary", "secondaryLight", "accent", "accentLight"] },
  { title: "Surfaces", keys: ["background", "surface", "surfaceSoft", "border"] },
  { title: "Buttons & text", keys: ["button", "buttonText", "foreground", "text", "mutedText"] }
];

export const tokenByKey = (tokens: ThemeToken[]) => new Map(tokens.map((t) => [t.key, t]));

/**
 * In-app screens a banner can open (expo-router paths in the app). The
 * backend validates any path, so "Other screen…" allows ones not listed.
 */
export const APP_DESTINATIONS: { value: string; label: string }[] = [
  { value: "/subscription", label: "My subscription / plans" },
  { value: "/consultation", label: "Book a consultation" },
  { value: "/tracker", label: "Cycle tracker" },
  { value: "/insights", label: "Daily insights" },
  { value: "/predictions", label: "Predictions" },
  { value: "/community", label: "Community" },
  { value: "/blogs", label: "Blogs" },
  { value: "/reels", label: "Videos" },
  { value: "/habits", label: "Habits" },
  { value: "/forest", label: "Wellness forest" },
  { value: "/qa", label: "Ask Nura AI" },
  { value: "/symptom-checker", label: "Symptom checker" },
  { value: "/government-schemes", label: "Government schemes" },
  { value: "/checkin-call", label: "Check-in call" }
];

export const HEX_OR_RGBA =
  /^(#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\))$/i;

export const isColor = (v: string) => HEX_OR_RGBA.test(v.trim());

/** #RRGGBB for an <input type="color">, from any hex/rgba value (alpha dropped). */
export const toHex6 = (value: string) => {
  const v = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join("")}`;
  if (/^#[0-9a-f]{6}/i.test(v)) return v.slice(0, 7);
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
  return "#000000";
};

export const staffName = (u?: { firstName?: string; lastName?: string; email?: string } | null) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "someone" : "someone";

export const relativeTime = (iso?: string | null) => {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
