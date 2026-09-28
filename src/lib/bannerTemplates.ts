import { EVERYONE, type BannerInput } from "./api";

/**
 * Ready-made banners for the Banners page. Picking one uploads its artwork
 * (public/banner-templates, drawn by scripts/banner-art.py) and opens the
 * editor prefilled, so nothing goes live until someone saves it.
 */
export type BannerTemplateGroup = "social" | "grow" | "in_app" | "support";

export type BannerTemplate = {
  key: string;
  name: string;
  group: BannerTemplateGroup;
  /** File in public/banner-templates, or null for a text-only strip. */
  image: string | null;
  /** Shown on the tile when the template needs something filled in. */
  setupNote?: string;
  banner: Omit<BannerInput, "imageUrl">;
};

export const TEMPLATE_GROUP_LABEL: Record<BannerTemplateGroup, string> = {
  social: "Social & community",
  grow: "Grow Nura",
  in_app: "Inside the app",
  support: "Help & support"
};

/** Link placeholders the editor refuses to save until they're replaced. */
export const PLACEHOLDER = /YOUR-[A-Z-]+/;

const PLAY_ID = "com.uvin124.thenura";

const base = {
  subtitle: null,
  ctaLabel: null,
  placement: "home_top",
  layout: "image",
  audience: EVERYONE,
  backgroundColor: null,
  textColor: null,
  priority: 50,
  active: true,
  dismissible: true,
  startAt: null,
  endAt: null
} satisfies Partial<BannerInput>;

export const BANNER_TEMPLATES: BannerTemplate[] = [
  {
    key: "whatsapp-community",
    name: "Join our WhatsApp community",
    group: "social",
    image: "whatsapp-community.png",
    setupNote: "Paste your community invite link",
    banner: {
      ...base,
      title: "Join the Nura circle on WhatsApp",
      subtitle: "Real talk, tips & support from women like you",
      ctaLabel: "Join",
      action: { type: "app", value: "https://chat.whatsapp.com/YOUR-INVITE-CODE", fallbackUrl: "https://chat.whatsapp.com/YOUR-INVITE-CODE" },
      priority: 70
    }
  },
  {
    key: "instagram-follow",
    name: "Follow on Instagram",
    group: "social",
    image: "instagram-follow.png",
    banner: {
      ...base,
      title: "Follow @thenura on Instagram",
      subtitle: "Daily tips, reels & real stories",
      ctaLabel: "Follow",
      action: { type: "app", value: "instagram://user?username=thenura", fallbackUrl: "https://www.instagram.com/thenura" },
      placement: "home_middle"
    }
  },
  {
    key: "youtube-subscribe",
    name: "Subscribe on YouTube",
    group: "social",
    image: "youtube-subscribe.png",
    banner: {
      ...base,
      title: "Doctor-led videos on YouTube",
      subtitle: "Periods, PCOS, pregnancy — explained simply",
      ctaLabel: "Subscribe",
      action: { type: "app", value: "youtube://www.youtube.com/@thenura", fallbackUrl: "https://www.youtube.com/@thenura" },
      placement: "explore_hub"
    }
  },
  {
    key: "website-visit",
    name: "Visit our website",
    group: "social",
    image: "website-visit.png",
    banner: {
      ...base,
      title: "Everything Nura, one click away",
      subtitle: "Guides, doctors, plans & our story",
      ctaLabel: "Visit",
      action: { type: "url", value: "https://thenura.care", fallbackUrl: null },
      placement: "profile"
    }
  },
  {
    key: "rate-us",
    name: "Rate us on Play Store",
    group: "grow",
    image: "rate-us.png",
    banner: {
      ...base,
      title: "Loving Nura? Rate us 5 stars",
      subtitle: "Your review helps more women find us",
      ctaLabel: "Rate",
      action: { type: "app", value: `market://details?id=${PLAY_ID}`, fallbackUrl: `https://play.google.com/store/apps/details?id=${PLAY_ID}` },
      placement: "profile",
      audience: { ...EVERYONE, segment: "signed_in", platforms: ["android"] }
    }
  },
  {
    key: "invite-friend",
    name: "Invite a friend",
    group: "grow",
    image: "thumb-invite.png",
    banner: {
      ...base,
      layout: "card",
      title: "Know someone who’d love Nura?",
      subtitle: "Share it with a friend on WhatsApp",
      ctaLabel: "Invite",
      action: {
        type: "app",
        value: "whatsapp://send?text=I%27ve%20been%20using%20Nura%20to%20understand%20my%20cycle%20%E2%80%94%20try%20it%3A%20https%3A%2F%2Fthenura.care%2Fapp",
        fallbackUrl: "https://wa.me/?text=I%27ve%20been%20using%20Nura%20to%20understand%20my%20cycle%20%E2%80%94%20try%20it%3A%20https%3A%2F%2Fthenura.care%2Fapp"
      },
      backgroundColor: "#ffe3ec",
      textColor: "#7a1f45",
      placement: "home_middle",
      audience: { ...EVERYONE, segment: "signed_in" }
    }
  },
  {
    key: "premium-unlock",
    name: "Unlock Premium",
    group: "grow",
    image: "premium-unlock.png",
    banner: {
      ...base,
      title: "Unlock Nura Premium",
      subtitle: "Deeper insights, doctor chats & no ads",
      ctaLabel: "See plans",
      action: { type: "route", value: "/(app)/subscription", fallbackUrl: null },
      audience: { ...EVERYONE, segment: "free" },
      priority: 80
    }
  },
  {
    key: "consultation",
    name: "Book a doctor",
    group: "in_app",
    image: "thumb-consultation.png",
    banner: {
      ...base,
      layout: "card",
      title: "Talk to a gynaecologist today",
      subtitle: "Private video consults from home",
      ctaLabel: "Book now",
      action: { type: "route", value: "/(app)/consultation", fallbackUrl: null },
      backgroundColor: "#fff0f4",
      textColor: "#8a1c47",
      placement: "care_hub"
    }
  },
  {
    key: "ask-ai",
    name: "Ask Nura AI",
    group: "in_app",
    image: "thumb-ask-ai.png",
    banner: {
      ...base,
      layout: "card",
      title: "Got a question? Ask Nura AI",
      subtitle: "Private answers, any time of day",
      ctaLabel: "Ask now",
      action: { type: "route", value: "/(app)/(dashboard)/ai-chat", fallbackUrl: null },
      backgroundColor: "#f1ecff",
      textColor: "#4c1d95",
      placement: "home_middle"
    }
  },
  {
    key: "community",
    name: "In-app community",
    group: "in_app",
    image: "thumb-community.png",
    banner: {
      ...base,
      layout: "card",
      title: "You’re not alone in this",
      subtitle: "Share, ask and cheer each other on",
      ctaLabel: "Join in",
      action: { type: "route", value: "/(app)/(dashboard)/community", fallbackUrl: null },
      backgroundColor: "#fff4e3",
      textColor: "#7c3a0a",
      placement: "wellness_hub"
    }
  },
  {
    key: "blogs",
    name: "New stories on the blog",
    group: "in_app",
    image: "thumb-blog.png",
    banner: {
      ...base,
      layout: "card",
      title: "Fresh reads this week",
      subtitle: "Food, mood & hormones — 3 min each",
      ctaLabel: "Read",
      action: { type: "route", value: "/(app)/blogs", fallbackUrl: null },
      backgroundColor: "#fff1e8",
      textColor: "#7a2e0e",
      placement: "explore_hub"
    }
  },
  {
    key: "forest",
    name: "Grow your wellness forest",
    group: "in_app",
    image: "thumb-forest.png",
    banner: {
      ...base,
      layout: "card",
      title: "Grow your wellness forest",
      subtitle: "Every healthy habit plants a tree",
      ctaLabel: "Plant one",
      action: { type: "route", value: "/(app)/forest", fallbackUrl: null },
      backgroundColor: "#e8f8ee",
      textColor: "#14532d",
      placement: "wellness_hub"
    }
  },
  {
    key: "log-today",
    name: "Log today",
    group: "in_app",
    image: "thumb-cycle.png",
    banner: {
      ...base,
      layout: "card",
      title: "How are you feeling today?",
      subtitle: "Log in 10 seconds for sharper predictions",
      ctaLabel: "Log now",
      action: { type: "route", value: "/(app)/(dashboard)/tracker", fallbackUrl: null },
      backgroundColor: "#ffe8ef",
      textColor: "#831843",
      audience: { ...EVERYONE, segment: "signed_in" },
      dismissible: false
    }
  },
  {
    key: "support-email",
    name: "Email support strip",
    group: "support",
    image: null,
    banner: {
      ...base,
      layout: "strip",
      title: "Questions? We’re here to help",
      ctaLabel: "Write to us",
      action: { type: "app", value: "mailto:hello@thenura.care", fallbackUrl: null },
      placement: "profile",
      priority: 10
    }
  },
  {
    key: "whatsapp-strip",
    name: "WhatsApp community strip",
    group: "support",
    image: null,
    setupNote: "Paste your community invite link",
    banner: {
      ...base,
      layout: "strip",
      title: "2,000+ women on our WhatsApp",
      ctaLabel: "Join",
      action: { type: "app", value: "https://chat.whatsapp.com/YOUR-INVITE-CODE", fallbackUrl: "https://chat.whatsapp.com/YOUR-INVITE-CODE" },
      backgroundColor: "#1fb866",
      textColor: "#ffffff",
      placement: "wellness_hub",
      priority: 20
    }
  }
];

const TEMPLATE_DIR = `${import.meta.env.BASE_URL}banner-templates/`;

export const templateImageUrl = (t: BannerTemplate) => (t.image ? `${TEMPLATE_DIR}${t.image}` : null);

/** True while a banner still points at bundled artwork that hasn't been uploaded yet. */
export const isTemplateImage = (url: string | null | undefined) => Boolean(url?.startsWith(TEMPLATE_DIR));

/** Fetches bundled template artwork as a File, ready for uploadImage. */
export async function templateImageFile(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load the template image.");
  return new File([await res.blob()], url.slice(TEMPLATE_DIR.length), { type: "image/png" });
}
