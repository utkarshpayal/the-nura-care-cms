import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutGrid, Megaphone, Palette, Rows3 } from "lucide-react";
import { resolvePalette, relativeTime, staffName } from "../lib/catalog";
import { useCms } from "../lib/store";
import { HomeScreen, PhoneFrame } from "../components/AppPreview";
import { PageHeader } from "../components/ui";

export const OverviewPage: React.FC = () => {
  const { config, banners, canManage } = useCms();
  const palette = useMemo(() => resolvePalette("light", config!.theme), [config]);
  const c = config!;

  const shown = c.features.filter((f) => f.enabled).length;
  const hiddenSections = c.homeSections.filter((s) => !s.visible).length;
  const live = banners.filter((b) => b.status === "live").length;
  const scheduled = banners.filter((b) => b.status === "scheduled").length;
  const taps = banners.reduce((sum, b) => sum + b.clickCount, 0);
  const views = banners.reduce((sum, b) => sum + (b.impressionCount ?? 0), 0);
  const links = c.customTiles.filter((t) => t.enabled).length;
  const moved = c.features.filter((f) => f.placement !== f.defaults.placement).length;
  const themed = Object.keys(c.theme.light).length + Object.keys(c.theme.dark).length;

  const cards = [
    {
      to: "/features",
      icon: LayoutGrid,
      title: "Features",
      value: `${shown} of ${c.features.length} shown`,
      note: [c.features.length - shown > 0 ? `${c.features.length - shown} hidden` : "none hidden", `${moved} moved`, `${links} link tile${links === 1 ? "" : "s"}`].join(" · ")
    },
    {
      to: "/home-layout",
      icon: Rows3,
      title: "Home layout",
      value: `${c.homeSections.length - hiddenSections} sections`,
      note: hiddenSections ? `${hiddenSections} hidden` : "All sections visible"
    },
    {
      to: "/banners",
      icon: Megaphone,
      title: "Banners & ads",
      value: `${live} live`,
      note: `${scheduled} scheduled · ${views.toLocaleString()} views · ${taps.toLocaleString()} taps${views ? ` · CTR ${((taps / views) * 100).toFixed(1)}%` : ""}`
    },
    {
      to: "/theme",
      icon: Palette,
      title: "Theme",
      value: themed ? `${themed} colours changed` : "App default",
      note: "Light & dark mode"
    }
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="App CMS" title="What the app shows">
        Control the Nura app without a release: which features appear and where, the Home screen, promo banners and the
        colour theme. Saved changes reach users the next time the app refreshes its config (on launch, and whenever it
        comes back to the foreground).
      </PageHeader>

      <div className="with-preview">
        <div>
          <div className="stat-grid">
            {cards.map(({ to, icon: Icon, title, value, note }) => (
              <Link key={to} to={to} className="card stat-card">
                <span className="stat-icon">
                  <Icon size={18} />
                </span>
                <span className="stat-title">{title}</span>
                <strong>{value}</strong>
                <span className="muted small">{note}</span>
                <ArrowRight size={15} className="stat-go" />
              </Link>
            ))}
          </div>

          {c.settings.maintenance.enabled && (
            <div className="notice notice-error" style={{ margin: "0 0 16px" }}>
              <strong>Maintenance mode is ON</strong> — the app is blocked for everyone. <Link to="/settings">Turn it off in App settings</Link>.
            </div>
          )}

          <section className="card">
            <h2 className="card-title">Status</h2>
            <dl className="facts">
              <div>
                <dt>Config version</dt>
                <dd>{c.version}</dd>
              </div>
              <div>
                <dt>Last change</dt>
                <dd>
                  {c.updatedAt ? `${relativeTime(c.updatedAt)} by ${staffName(c.updatedBy)}` : "Nothing changed yet — the app uses its defaults"}
                </dd>
              </div>
              <div>
                <dt>Update prompts</dt>
                <dd>
                  {c.settings.update.minVersion || c.settings.update.latestVersion
                    ? [c.settings.update.minVersion && `force below v${c.settings.update.minVersion}`, c.settings.update.latestVersion && `suggest below v${c.settings.update.latestVersion}`].filter(Boolean).join(" · ")
                    : "Off"}
                </dd>
              </div>
              <div>
                <dt>Your access</dt>
                <dd>{canManage ? "Can edit and publish" : "View only (ask a Super Admin for cms.manage)"}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title">Good to know</h2>
            <ul className="tips">
              <li>Hiding a feature removes its tile from the app. A hub with no visible features also drops off Home.</li>
              <li>Made a mistake? History restores any earlier version of a section in one click.</li>
              <li>Older app versions ignore settings they don't know about, so nothing here can break an old build.</li>
              <li>If the app can't reach the server it keeps the last layout it downloaded, or its built-in defaults.</li>
              <li>Every change is recorded in the Admin Workspace's audit log.</li>
            </ul>
          </section>
        </div>

        <aside className="preview-col">
          <p className="muted small center">Home screen right now</p>
          <PhoneFrame palette={palette}>
            <HomeScreen sections={c.homeSections} features={c.features} links={c.customTiles} banners={banners} palette={palette} mode="light" />
          </PhoneFrame>
        </aside>
      </div>
    </div>
  );
};
